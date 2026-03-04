import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum InsightType {
  REVENUE_ANOMALY = 'revenue_anomaly',
  CONVERSION_DROP = 'conversion_drop',
  HIGH_AOV = 'high_aov',
  CUSTOMER_GROWTH = 'customer_growth',
  CART_ABANDONMENT = 'cart_abandonment',
  REPEAT_CUSTOMER = 'repeat_customer',
  LOW_ENGAGEMENT = 'low_engagement',
  SEASONAL_TREND = 'seasonal_trend'
}

export enum InsightSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

@Entity('insights')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'type'])
export class Insight {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  storeId?: string;

  @Column({ type: 'varchar', enum: InsightType })
  type!: InsightType;

  @Column({ type: 'varchar', enum: InsightSeverity, default: InsightSeverity.INFO })
  severity!: InsightSeverity;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'boolean', default: false })
  isActioned!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
