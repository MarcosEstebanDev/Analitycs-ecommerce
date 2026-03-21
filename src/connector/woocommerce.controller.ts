import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  BadRequestException,
  UnauthorizedException,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { WooCommerceService } from './services';

@Controller('connectors/woo')
export class WooCommerceController {
  private readonly logger = new Logger(WooCommerceController.name);

  constructor(private readonly wooService: WooCommerceService) {}

  /**
   * Onboard a WooCommerce store for the current tenant.
   * Body: { siteUrl: string, consumerKey: string, consumerSecret: string }
   * Uses x-tenant-id header for tenant context.
   */
  @Post('connect-store')
  async connectStore(
    @Body('siteUrl') siteUrl: string,
    @Body('consumerKey') consumerKey: string,
    @Body('consumerSecret') consumerSecret: string,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context (x-tenant-id header)');
    }

    try {
      const store = await this.wooService.connectStore(tenantId, siteUrl, consumerKey, consumerSecret);
      return { success: true, data: store };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error connecting WooCommerce store: ${message}`);
      return { success: false, error: message };
    }
  }

  @Post('webhook/orders-created')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true, forbidNonWhitelisted: false }))
  @HttpCode(202)
  async handleOrdersCreated(
    @Body() body: any,
    @Headers('x-wc-webhook-signature') signature: string | undefined,
    @Headers('x-wc-webhook-source') webhookSource: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context (x-tenant-id header)');
    }

    // Resolve storeId: look up by the webhook source URL
    const storeId = req.headers['x-wc-store-id'] as string | undefined;

    if (!storeId) {
      throw new BadRequestException('Missing store ID (x-wc-store-id header)');
    }

    const nodeEnv = process.env.NODE_ENV ?? 'development';
    if (nodeEnv !== 'development') {
      const rawBody = JSON.stringify(body);
      const isValid = this.wooService.validateWebhook(rawBody, signature);
      if (!isValid) {
        this.logger.warn(`Invalid WooCommerce webhook signature for tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    try {
      await this.wooService.processOrderCreated(tenantId, storeId, body);
      return { accepted: true, provider: 'woocommerce', tenantId, orderId: body.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing WooCommerce webhook: ${message}`);
      throw new Error('Failed to process webhook');
    }
  }

  @Post('webhook/orders-updated')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true, forbidNonWhitelisted: false }))
  @HttpCode(202)
  async handleOrdersUpdated(
    @Body() body: any,
    @Headers('x-wc-webhook-signature') signature: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    const storeId = req.headers['x-wc-store-id'] as string | undefined;

    if (!storeId) {
      throw new BadRequestException('Missing store ID (x-wc-store-id header)');
    }

    const nodeEnv = process.env.NODE_ENV ?? 'development';
    if (nodeEnv !== 'development') {
      const rawBody = JSON.stringify(body);
      const isValid = this.wooService.validateWebhook(rawBody, signature);
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    try {
      await this.wooService.processOrderUpdated(tenantId, storeId, body);
      return { accepted: true, provider: 'woocommerce', tenantId, orderId: body.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing WooCommerce order update: ${message}`);
      throw new Error('Failed to process webhook');
    }
  }
}
