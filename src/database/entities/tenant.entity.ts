import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Store } from './store.entity';

export enum TenantPlan {
  FREE = 'free',
  GROWTH = 'growth',
  SCALE = 'scale',
  PRO = 'pro'
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', enum: TenantPlan, default: TenantPlan.FREE })
  plan!: TenantPlan;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Store, (store) => store.tenant)
  stores!: Store[];
}
