import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notifications/notifications.module';
import { AnalyticsService, AnomalyDetectionService, AlertService } from './services';
import { StoreService, OrderService, CustomerService } from '../database/services';
import { DashboardController } from './controllers/dashboard.controller';
import { OrdersController } from './controllers/orders.controller';
import { CustomersController } from './controllers/customers.controller';

@Module({
  imports: [DatabaseModule, NotificationModule],
  providers: [AnalyticsService, AnomalyDetectionService, AlertService, StoreService, OrderService, CustomerService],
  exports: [AnalyticsService, AnomalyDetectionService, AlertService],
  controllers: [DashboardController, OrdersController, CustomersController],
})
export class AnalyticsModule {}
