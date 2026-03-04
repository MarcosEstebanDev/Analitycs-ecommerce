import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Order } from './order.entity';
import { Customer } from './customer.entity';

export enum StoreProvider {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  CUSTOM = 'custom'
}

@Entity('stores')
@Index(['tenantId', 'provider'])
@Index(['tenantId', 'externalId'])
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', enum: StoreProvider })
  provider!: StoreProvider;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 500 })
  externalId!: string;

  @Column({ type: 'varchar', length: 1024 })
  accessToken!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  refreshToken?: string;

  @Column({ type: 'bigint', default: 0 })
  totalOrdersSync!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.stores, { onDelete: 'CASCADE' })
  tenant!: Tenant;

  @OneToMany(() => Order, (order) => order.store)
  orders!: Order[];

  @OneToMany(() => Customer, (customer) => customer.store)
  customers!: Customer[];
}
