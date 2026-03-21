import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant, Store, Order, OrderItem, Customer, Insight, User } from './entities';
import { TenantService, StoreService, OrderService, CustomerService, InsightService, UserService } from './services';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV', 'development');

        return {
          type: 'postgres',
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USER', 'analytics_user'),
          password: configService.get('DB_PASSWORD', 'analytics_password'),
          database: configService.get('DB_NAME', 'analytics_db'),
          entities: [Tenant, Store, Order, OrderItem, Customer, Insight, User],
          synchronize: nodeEnv === 'development',
          // Log only queries and errors in development, and only errors in other envs
          logging: nodeEnv === 'development' ? ['query', 'error'] : ['error'],
        };
      },
    }),
    TypeOrmModule.forFeature([Tenant, Store, Order, OrderItem, Customer, Insight, User]),
  ],
  providers: [TenantService, StoreService, OrderService, CustomerService, InsightService, UserService],
  exports: [TenantService, StoreService, OrderService, CustomerService, InsightService, UserService, TypeOrmModule],
})
export class DatabaseModule {}
