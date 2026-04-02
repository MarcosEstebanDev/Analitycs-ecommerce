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
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: Number(url.port) || 6379,
              password: url.password || undefined,
              username: url.username || undefined,
            },
          };
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') ?? 'localhost',
            port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
          },
        };
      },
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
