import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notifications/notifications.module';
import { AnalyticsService, AnomalyDetectionService, AlertService } from './services';
import { DashboardController } from './controllers/dashboard.controller';

@Module({
  imports: [DatabaseModule, NotificationModule],
  providers: [AnalyticsService, AnomalyDetectionService, AlertService],
  exports: [AnalyticsService, AnomalyDetectionService, AlertService],
  controllers: [DashboardController],
})
export class AnalyticsModule {}
