import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AnomalyDetectionProcessor } from './processors/anomaly-detection.processor';
import { JobSchedulerService } from './services/job-scheduler.service';
import { JobsController } from './controllers/jobs.controller';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'anomaly-detection' },
    ),
    DatabaseModule,
    AnalyticsModule,
  ],
  providers: [AnomalyDetectionProcessor, JobSchedulerService],
  exports: [JobSchedulerService],
  controllers: [JobsController],
})
export class JobsModule {}
