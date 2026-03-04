import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ShopifyController } from './shopify.controller';
import { ShopifyService } from './services';

@Module({
  imports: [DatabaseModule],
  controllers: [ShopifyController],
  providers: [ShopifyService],
})
export class ConnectorModule {}
