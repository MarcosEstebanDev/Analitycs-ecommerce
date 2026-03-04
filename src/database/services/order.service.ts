import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async create(
    tenantId: string,
    storeId: string,
    externalId: string,
    totalAmount: number,
    data: Partial<Order> = {},
  ): Promise<Order> {
    const order = this.orderRepository.create({
      tenantId,
      storeId,
      externalId,
      totalAmount,
      ...data,
    });
    return this.orderRepository.save(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['store', 'customer', 'items'],
    });
  }

  async findByExternalId(tenantId: string, externalId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { tenantId, externalId },
      relations: ['items'],
    });
  }

  async findByStoreId(
    storeId: string,
    skip = 0,
    take = 100,
    status?: OrderStatus,
  ): Promise<{ data: Order[]; total: number }> {
    const query = this.orderRepository.createQueryBuilder('order').where('order.storeId = :storeId', { storeId });

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    const [data, total] = await query.orderBy('order.createdAt', 'DESC').skip(skip).take(take).getManyAndCount();

    return { data, total };
  }

  async findByTenantId(
    tenantId: string,
    skip = 0,
    take = 100,
    status?: OrderStatus,
  ): Promise<{ data: Order[]; total: number }> {
    const query = this.orderRepository.createQueryBuilder('order').where('order.tenantId = :tenantId', { tenantId });

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    const [data, total] = await query.orderBy('order.createdAt', 'DESC').skip(skip).take(take).getManyAndCount();

    return { data, total };
  }

  async update(id: string, updates: Partial<Order>): Promise<Order | null> {
    await this.orderRepository.update(id, updates as any);
    return this.findById(id);
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    await this.orderRepository.update(id, { status });
    return this.findById(id);
  }

  async findOrdersInDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.createdAt >= :startDate', { startDate })
      .andWhere('order.createdAt <= :endDate', { endDate })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }

  async delete(id: string): Promise<void> {
    await this.orderRepository.delete(id);
  }
}
