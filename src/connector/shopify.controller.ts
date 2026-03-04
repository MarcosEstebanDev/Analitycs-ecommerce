import { Body, Controller, Headers, HttpCode, Post, Req, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ShopifyService } from './services';
import { ShopifyOrderPayload } from './dto/shopify-order.dto';

@Controller('connectors/shopify')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(private readonly shopifyService: ShopifyService) {}

  @Post('webhook/orders-created')
  @HttpCode(202)
  async handleOrdersCreated(
    @Body() body: ShopifyOrderPayload,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-shop-id') shopifyStoreId: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context (x-tenant-id header)');
    }

    if (!shopifyStoreId) {
      throw new BadRequestException('Missing Shopify store ID (x-shopify-shop-id header)');
    }

    // Get raw body for HMAC validation
    const rawBody = JSON.stringify(body);
    const isValid = this.shopifyService.validateWebhook(rawBody, hmac);

    if (!isValid) {
      this.logger.warn(`Invalid HMAC for tenant ${tenantId}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      // In a real scenario, we'd look up the store by storeId
      // For now, we'll accept the storeId as a parameter
      await this.shopifyService.processOrderCreated(tenantId, shopifyStoreId, body);

      return {
        accepted: true,
        provider: 'shopify',
        tenantId,
        orderId: body.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing webhook: ${message}`);
      throw new Error('Failed to process webhook');
    }
  }

  @Post('webhook/orders-updated')
  @HttpCode(202)
  async handleOrdersUpdated(
    @Body() body: ShopifyOrderPayload,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Headers('x-shopify-shop-id') shopifyStoreId: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    if (!shopifyStoreId) {
      throw new BadRequestException('Missing Shopify store ID');
    }

    const rawBody = JSON.stringify(body);
    const isValid = this.shopifyService.validateWebhook(rawBody, hmac);

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      await this.shopifyService.processOrderUpdated(tenantId, shopifyStoreId, body);

      return {
        accepted: true,
        provider: 'shopify',
        tenantId,
        orderId: body.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing webhook: ${message}`);
      throw new Error('Failed to process webhook');
    }
  }
}
