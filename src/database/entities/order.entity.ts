import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Store } from './store.entity';
import { Customer } from './customer.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

@Entity('orders')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'storeId'])
@Index(['externalId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  storeId!: string;

  @Column({ type: 'uuid', nullable: true })
  customerId?: string;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalCustomerId?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  tax!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  shipping!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discount!: number;

  @Column({ type: 'varchar', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Store, (store) => store.orders, { onDelete: 'CASCADE' })
  store!: Store;

  @ManyToOne(() => Customer, (customer) => customer.orders, { nullable: true, onDelete: 'SET NULL' })
  customer?: Customer;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: OrderItem[];
}
