import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ShopifyController } from './shopify.controller';
import { WooCommerceController } from './woocommerce.controller';
import { ShopifyService, WooCommerceService } from './services';

@Module({
  imports: [DatabaseModule],
  controllers: [ShopifyController, WooCommerceController],
  providers: [ShopifyService, WooCommerceService],
})
export class ConnectorModule {}
