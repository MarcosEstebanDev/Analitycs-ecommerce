import { Body, Controller, Headers, HttpCode, Post, Req, BadRequestException, UnauthorizedException, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { ShopifyService } from './services';

@Controller('connectors/shopify')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(private readonly shopifyService: ShopifyService) {}

  /**
   * Onboard a Shopify store for the current tenant.
   * Expected body: { shopDomain: string, accessToken: string }
   * Uses x-tenant-id header for tenant context.
   */
  @Post('connect-store')
  async connectStore(
    @Body('shopDomain') shopDomain: string,
    @Body('accessToken') accessToken: string,
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context (x-tenant-id header)');
    }

    try {
      const store = await this.shopifyService.connectStore(tenantId, shopDomain, accessToken);
      return {
        success: true,
        data: store,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error connecting Shopify store: ${message}`);
      return { success: false, error: message };
    }
  }

  @Post('webhook/orders-created')
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true, forbidNonWhitelisted: false }))
  @HttpCode(202)
  async handleOrdersCreated(
    @Body() body: any,
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

    const nodeEnv = process.env.NODE_ENV ?? 'development';

    // In development, skip HMAC validation entirely to simplify local testing
    if (nodeEnv !== 'development') {
      const rawBody = JSON.stringify(body);
      const isValid = this.shopifyService.validateWebhook(rawBody, hmac);

      if (!isValid) {
        this.logger.warn(`Invalid HMAC for tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }
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
  @UsePipes(new ValidationPipe({ whitelist: false, transform: true, forbidNonWhitelisted: false }))
  @HttpCode(202)
  async handleOrdersUpdated(
    @Body() body: any,
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

    const nodeEnv = process.env.NODE_ENV ?? 'development';

    if (nodeEnv !== 'development') {
      const rawBody = JSON.stringify(body);
      const isValid = this.shopifyService.validateWebhook(rawBody, hmac);

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
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
