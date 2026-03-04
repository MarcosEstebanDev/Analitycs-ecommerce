import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Tenant, Store, Order, OrderItem, Customer, Insight } from './entities';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'analytics_user',
  password: process.env.DB_PASSWORD || 'analytics_password',
  database: process.env.DB_NAME || 'analytics_db',
  entities: [Tenant, Store, Order, OrderItem, Customer, Insight],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: true,
};
