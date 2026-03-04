import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async create(
    tenantId: string,
    storeId: string,
    externalId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
  ): Promise<Customer> {
    const customer = this.customerRepository.create({
      tenantId,
      storeId,
      externalId,
      email,
      firstName,
      lastName,
    });
    return this.customerRepository.save(customer);
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { id },
      relations: ['orders'],
    });
  }

  async findByExternalId(tenantId: string, storeId: string, externalId: string): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { tenantId, storeId, externalId },
    });
  }

  async findByStoreId(storeId: string, skip = 0, take = 100): Promise<{ data: Customer[]; total: number }> {
    const [data, total] = await this.customerRepository.findAndCount({
      where: { storeId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total };
  }

  async findByTenantId(tenantId: string, skip = 0, take = 100): Promise<{ data: Customer[]; total: number }> {
    const [data, total] = await this.customerRepository.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total };
  }

  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    await this.customerRepository.update(id, updates as any);
    return this.findById(id);
  }

  async incrementMetrics(id: string, orderAmount: number): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (customer) {
      await this.customerRepository.update(id, {
        lifetimeValue: customer.lifetimeValue + orderAmount,
        totalOrders: customer.totalOrders + 1,
        lastOrderAt: new Date(),
      });
    }
    return this.findById(id);
  }

  async findTopCustomers(tenantId: string, limit = 10): Promise<Customer[]> {
    return this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.tenantId = :tenantId', { tenantId })
      .orderBy('customer.lifetimeValue', 'DESC')
      .limit(limit)
      .getMany();
  }

  async delete(id: string): Promise<void> {
    await this.customerRepository.delete(id);
  }
}
