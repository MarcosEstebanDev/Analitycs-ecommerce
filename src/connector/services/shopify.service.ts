import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrderService, CustomerService, StoreService, InsightService } from '../../database/services';
import { OrderStatus, InsightType, InsightSeverity } from '../../database/entities';
import { ShopifyOrderPayload } from '../dto/shopify-order.dto';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly apiSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
    private readonly storeService: StoreService,
    private readonly insightService: InsightService,
  ) {
    this.apiSecret = this.configService.get('SHOPIFY_API_SECRET', '');
  }

  /**
   * Validates HMAC signature from Shopify webhook
   */
  validateWebhook(body: string, hmacHeader: string | undefined): boolean {
    if (!hmacHeader) {
      this.logger.warn('No HMAC header provided');
      return false;
    }

    if (!this.apiSecret) {
      this.logger.error('SHOPIFY_API_SECRET not configured');
      return false;
    }

    const hmac = crypto
      .createHmac('sha256', this.apiSecret)
      .update(body, 'utf8')
      .digest('base64');

    return hmac === hmacHeader;
  }

  /**
   * Process order.created webhook from Shopify
   */
  async processOrderCreated(
    tenantId: string,
    storeId: string,
    payload: ShopifyOrderPayload,
  ): Promise<void> {
    try {
      const externalOrderId = String(payload.id);
      
      // Check if order already exists
      const existingOrder = await this.orderService.findByExternalId(tenantId, externalOrderId);
      if (existingOrder) {
        this.logger.log(`Order ${externalOrderId} already exists`);
        return;
      }

      // Get or create customer
      const externalCustomerId = String(payload.customer?.id || '');
      let customer = null;

      if (externalCustomerId && payload.customer) {
        customer = await this.customerService.findByExternalId(tenantId, storeId, externalCustomerId);
        if (!customer) {
          customer = await this.customerService.create(
            tenantId,
            storeId,
            externalCustomerId,
            payload.customer.email,
            payload.customer.first_name,
            payload.customer.last_name,
          );
        }
      }

      // Create order
      const totalAmount = parseFloat(payload.total_price);
      const subtotal = parseFloat(payload.subtotal_price);
      const tax = parseFloat(payload.total_tax);
      const shipping = payload.shipping_lines?.[0]?.price ? parseFloat(payload.shipping_lines[0].price) : 0;
      const discount = payload.discount_applications?.reduce((acc, app) => acc + parseFloat(app.value), 0) || 0;

      const order = await this.orderService.create(
        tenantId,
        storeId,
        externalOrderId,
        totalAmount,
        {
          customerId: customer?.id,
          externalCustomerId,
          status: OrderStatus.PENDING,
          subtotal,
          tax,
          shipping,
          discount,
          currency: payload.currency,
          metadata: {
            shopifyOrderName: payload.name,
            shopifyCustomerEmail: payload.email,
            financialStatus: payload.financial_status,
            createdAt: payload.created_at,
          },
        },
      );

      // Update customer metrics if exists
      if (customer) {
        await this.customerService.incrementMetrics(customer.id, totalAmount);
      }

      // Create insight for high-value order
      if (totalAmount > 500) {
        await this.insightService.create(
          tenantId,
          InsightType.HIGH_AOV,
          `High-value order detected: $${totalAmount.toFixed(2)}`,
          InsightSeverity.INFO,
          { orderId: order.id, orderTotal: totalAmount },
          storeId,
          `Customer ${payload.customer?.first_name} placed a high-value order`,
        );
      }

      // Update store sync count
      await this.storeService.incrementOrdersSync(storeId, 1);

      this.logger.log(`Order ${externalOrderId} processed successfully for tenant ${tenantId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Error processing order: ${message}`, stack);
      throw error as Error;
    }
  }

  /**
   * Process order.updated webhook
   */
  async processOrderUpdated(
    tenantId: string,
    storeId: string,
    payload: ShopifyOrderPayload,
  ): Promise<void> {
    try {
      const externalOrderId = String(payload.id);
      const order = await this.orderService.findByExternalId(tenantId, externalOrderId);

      if (!order) {
        this.logger.warn(`Order ${externalOrderId} not found for update`);
        return;
      }

      // Update order status based on financial_status
      let newStatus = OrderStatus.PENDING;
      if (payload.financial_status === 'paid') {
        newStatus = OrderStatus.CONFIRMED;
      } else if (payload.financial_status === 'refunded') {
        newStatus = OrderStatus.REFUNDED;
      }

      await this.orderService.updateStatus(order.id, newStatus);

      this.logger.log(`Order ${externalOrderId} updated to status ${newStatus}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`Error updating order: ${message}`, stack);
      throw error as Error;
    }
  }
}
