import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { ConnectorModule } from './connector/connector.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JobsModule } from './jobs/jobs.module';
import { TenantModule } from './tenant/tenant.module';
import { BillingModule } from './billing/billing.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 10 },   // 10 req/min (auth endpoints)
      { name: 'long',  ttl: 60000, limit: 150 },  // 150 req/min (API endpoints)
    ]),
    DatabaseModule,
    AuthModule,
    TenantModule,
    BillingModule,
    ConnectorModule,
    HealthModule,
    AnalyticsModule,
    JobsModule,
    UsersModule,
    NotificationsModule,
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}