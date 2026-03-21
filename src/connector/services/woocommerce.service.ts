import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrderService, CustomerService, StoreService, InsightService, TenantService } from '../../database/services';
import { OrderStatus, InsightType, InsightSeverity, StoreProvider } from '../../database/entities';
import { getMonthlyOrderLimit } from '../../tenant/plan-limits';
import { WooOrderPayload } from '../dto/woocommerce-order.dto';

const WOO_STATUS_MAP: Record<string, OrderStatus> = {
  pending: OrderStatus.PENDING,
  processing: OrderStatus.CONFIRMED,
  'on-hold': OrderStatus.PENDING,
  completed: OrderStatus.CONFIRMED,
  cancelled: OrderStatus.CANCELLED,
  refunded: OrderStatus.REFUNDED,
  failed: OrderStatus.CANCELLED,
};

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
    private readonly storeService: StoreService,
    private readonly insightService: InsightService,
    private readonly tenantService: TenantService,
  ) {
    this.webhookSecret = this.configService.get('WOO_WEBHOOK_SECRET', '');
  }

  /**
   * Register or update a WooCommerce store for a tenant.
   * WooCommerce uses consumer key + consumer secret for REST API auth.
   * We store the consumer key as accessToken and consumer secret as refreshToken.
   */
  async connectStore(
    tenantId: string,
    siteUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ) {
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!siteUrl) throw new BadRequestException('Missing site URL');
    if (!consumerKey) throw new BadRequestException('Missing consumer key');
    if (!consumerSecret) throw new BadRequestException('Missing consumer secret');

    // Normalize the siteUrl as the externalId
    const normalizedUrl = siteUrl.replace(/\/$/, '').toLowerCase();
    const name = new URL(normalizedUrl).hostname;

    // Encode credentials as Basic Auth token for storage
    const encodedCredentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const existing = await this.storeService.findByExternalId(
      tenantId,
      normalizedUrl,
      StoreProvider.WOOCOMMERCE,
    );

    if (existing) {
      return this.storeService.update(existing.id, {
        accessToken: encodedCredentials,
        isActive: true,
        metadata: { siteUrl: normalizedUrl },
      });
    }

    return this.storeService.create(
      tenantId,
      StoreProvider.WOOCOMMERCE,
      name,
      normalizedUrl,
      encodedCredentials,
    );
  }

  /**
   * Validates HMAC-SHA256 signature from WooCommerce webhook.
   * WooCommerce sends the signature in the X-WC-Webhook-Signature header.
   */
  validateWebhook(body: string, signature: string | undefined): boolean {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');

    if (nodeEnv === 'development') {
      this.logger.warn('Skipping WooCommerce webhook HMAC validation in development');
      return true;
    }

    if (!signature) {
      this.logger.warn('No webhook signature provided');
      return false;
    }

    if (!this.webhookSecret) {
      this.logger.error('WOO_WEBHOOK_SECRET not configured');
      return false;
    }

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body, 'utf8')
      .digest('base64');

    return expected === signature;
  }

  /**
   * Process order.created webhook from WooCommerce
   */
  async processOrderCreated(
    tenantId: string,
    storeId: string,
    payload: WooOrderPayload,
  ): Promise<void> {
    try {
      const tenant = await this.tenantService.findById(tenantId);
      if (!tenant) throw new BadRequestException('Tenant not found');

      const monthlyLimit = getMonthlyOrderLimit(tenant.plan);
      if (monthlyLimit !== null) {
        const currentCount = await this.orderService.countOrdersForTenantInMonth(tenantId);
        if (currentCount >= monthlyLimit) {
          this.logger.warn(`Tenant ${tenantId} exceeded monthly order limit`);
          throw new BadRequestException('Monthly order limit exceeded. Please upgrade your plan.');
        }
      }

      const externalOrderId = String(payload.id);

      const existingOrder = await this.orderService.findByExternalId(tenantId, externalOrderId);
      if (existingOrder) {
        this.logger.log(`WooCommerce order ${externalOrderId} already exists`);
        return;
      }

      // Get or create customer from billing info
      let customer = null;
      const externalCustomerId = payload.customer_id ? String(payload.customer_id) : null;

      if (externalCustomerId && externalCustomerId !== '0' && payload.billing?.email) {
        customer = await this.customerService.findByExternalId(tenantId, storeId, externalCustomerId);
        if (!customer) {
          customer = await this.customerService.create(
            tenantId,
            storeId,
            externalCustomerId,
            payload.billing.email,
            payload.billing.first_name,
            payload.billing.last_name,
          );
        }
      }

      const totalAmount = parseFloat(payload.total);
      const subtotal = parseFloat(payload.subtotal || '0');
      const tax = parseFloat(payload.total_tax || '0');
      const shipping = payload.shipping_lines?.[0]?.total
        ? parseFloat(payload.shipping_lines[0].total)
        : 0;
      const discount = parseFloat(payload.discount_total || '0');

      const order = await this.orderService.create(
        tenantId,
        storeId,
        externalOrderId,
        totalAmount,
        {
          customerId: customer?.id,
          externalCustomerId: externalCustomerId ?? '',
          status: WOO_STATUS_MAP[payload.status] ?? OrderStatus.PENDING,
          subtotal,
          tax,
          shipping,
          discount,
          currency: payload.currency,
          metadata: {
            wooOrderNumber: payload.number,
            wooStatus: payload.status,
            customerEmail: payload.billing?.email,
            createdAt: payload.date_created,
          },
        },
      );

      if (customer) {
        await this.customerService.incrementMetrics(customer.id, totalAmount);
      }

      if (totalAmount > 500) {
        await this.insightService.create(
          tenantId,
          InsightType.HIGH_AOV,
          `WooCommerce high-value order: $${totalAmount.toFixed(2)}`,
          InsightSeverity.INFO,
          { orderId: order.id, orderTotal: totalAmount },
          storeId,
          `Customer ${payload.billing?.first_name ?? ''} placed a high-value WooCommerce order`,
        );
      }

      await this.storeService.incrementOrdersSync(storeId, 1);

      this.logger.log(`WooCommerce order ${externalOrderId} processed for tenant ${tenantId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Error processing WooCommerce order: ${message}`, stack);
      throw error as Error;
    }
  }

  /**
   * Process order.updated webhook from WooCommerce
   */
  async processOrderUpdated(
    tenantId: string,
    storeId: string,
    payload: WooOrderPayload,
  ): Promise<void> {
    try {
      const externalOrderId = String(payload.id);
      const order = await this.orderService.findByExternalId(tenantId, externalOrderId);

      if (!order) {
        this.logger.warn(`WooCommerce order ${externalOrderId} not found for update`);
        return;
      }

      const newStatus = WOO_STATUS_MAP[payload.status] ?? OrderStatus.PENDING;
      await this.orderService.updateStatus(order.id, newStatus);

      this.logger.log(`WooCommerce order ${externalOrderId} updated to status ${newStatus}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Error updating WooCommerce order: ${message}`, stack);
      throw error as Error;
    }
  }
}
