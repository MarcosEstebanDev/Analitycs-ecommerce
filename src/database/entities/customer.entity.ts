import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Store } from './store.entity';
import { Order } from './order.entity';

@Entity('customers')
@Index(['tenantId', 'storeId'])
@Index(['externalId'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  storeId!: string;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  lifetimeValue!: number;

  @Column({ type: 'integer', default: 0 })
  totalOrders!: number;

  @Column({ type: 'integer', default: 0 })
  totalQuantity!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastOrderAt?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Store, (store) => store.customers, { onDelete: 'CASCADE' })
  store!: Store;

  @OneToMany(() => Order, (order) => order.customer)
  orders!: Order[];
}
