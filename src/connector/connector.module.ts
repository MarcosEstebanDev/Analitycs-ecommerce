import { Module } from '@nestjs/common';
import { ShopifyController } from './shopify.controller';

@Module({
  controllers: [ShopifyController]
})
export class ConnectorModule {}
