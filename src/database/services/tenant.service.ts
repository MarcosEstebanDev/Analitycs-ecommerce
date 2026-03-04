import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantPlan } from '../entities';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(name: string, slug: string, plan: TenantPlan = TenantPlan.FREE): Promise<Tenant> {
    const tenant = this.tenantRepository.create({ name, slug, plan });
    return this.tenantRepository.save(tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { slug } });
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async update(id: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    await this.tenantRepository.update(id, updates as any);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.tenantRepository.delete(id);
  }

  async updatePlan(id: string, plan: TenantPlan): Promise<Tenant | null> {
    await this.tenantRepository.update(id, { plan });
    return this.findById(id);
  }
}
