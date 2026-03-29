import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant, Store, Order, OrderItem, Customer, Insight, User } from './entities';
import { TenantService, StoreService, OrderService, CustomerService, InsightService, UserService } from './services';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV', 'development');
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const dbSync = configService.get('DB_SYNC') === 'true';

        const shared = {
          type: 'postgres' as const,
          entities: [Tenant, Store, Order, OrderItem, Customer, Insight, User],
          synchronize: nodeEnv === 'development' || dbSync,
          logging: (nodeEnv === 'development' ? ['query', 'error'] : ['error']) as any,
        };

        if (databaseUrl) {
          return { ...shared, url: databaseUrl, ssl: { rejectUnauthorized: false } };
        }

        return {
          ...shared,
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USER', 'analytics_user'),
          password: configService.get('DB_PASSWORD', 'analytics_password'),
          database: configService.get('DB_NAME', 'analytics_db'),
        };
      },
    }),
    TypeOrmModule.forFeature([Tenant, Store, Order, OrderItem, Customer, Insight, User]),
    NotificationsModule,
  ],
  providers: [TenantService, StoreService, OrderService, CustomerService, InsightService, UserService],
  exports: [TenantService, StoreService, OrderService, CustomerService, InsightService, UserService, TypeOrmModule],
})
export class DatabaseModule {}
