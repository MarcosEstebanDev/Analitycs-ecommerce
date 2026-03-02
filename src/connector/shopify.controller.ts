import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('connectors/shopify')
export class ShopifyController {
  @Post('webhook/orders-created')
  @HttpCode(202)
  handleOrdersCreated(
    @Body() body: Record<string, unknown>,
    @Headers('x-shopify-hmac-sha256') hmac: string | undefined,
    @Req() req: Request
  ) {
    return {
      accepted: true,
      provider: 'shopify',
      tenantId: req['tenantId'] ?? null,
      webhookVerified: Boolean(hmac),
      receivedKeys: Object.keys(body)
    };
  }
}
