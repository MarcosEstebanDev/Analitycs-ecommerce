import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insight, InsightType, InsightSeverity } from '../entities';

@Injectable()
export class InsightService {
  constructor(
    @InjectRepository(Insight)
    private readonly insightRepository: Repository<Insight>,
  ) {}

  async create(
    tenantId: string,
    type: InsightType,
    message: string,
    severity: InsightSeverity = InsightSeverity.INFO,
    data?: Record<string, unknown>,
    storeId?: string,
    description?: string,
  ): Promise<Insight> {
    const insight = this.insightRepository.create({
      tenantId,
      storeId,
      type,
      message,
      severity,
      description,
      data,
    });
    return this.insightRepository.save(insight);
  }

  async findById(id: string): Promise<Insight | null> {
    return this.insightRepository.findOne({ where: { id } });
  }

  async findByTenantId(
    tenantId: string,
    skip = 0,
    take = 50,
    unreadOnly = false,
  ): Promise<{ data: Insight[]; total: number }> {
    const query = this.insightRepository
      .createQueryBuilder('insight')
      .where('insight.tenantId = :tenantId', { tenantId });

    if (unreadOnly) {
      query.andWhere('insight.isRead = false');
    }

    const [data, total] = await query.orderBy('insight.createdAt', 'DESC').skip(skip).take(take).getManyAndCount();

    return { data, total };
  }

  async findByStoreId(
    storeId: string,
    skip = 0,
    take = 50,
    unreadOnly = false,
  ): Promise<{ data: Insight[]; total: number }> {
    const query = this.insightRepository
      .createQueryBuilder('insight')
      .where('insight.storeId = :storeId', { storeId });

    if (unreadOnly) {
      query.andWhere('insight.isRead = false');
    }

    const [data, total] = await query.orderBy('insight.createdAt', 'DESC').skip(skip).take(take).getManyAndCount();

    return { data, total };
  }

  async markAsRead(id: string): Promise<Insight | null> {
    await this.insightRepository.update(id, { isRead: true });
    return this.findById(id);
  }

  async markAsActioned(id: string): Promise<Insight | null> {
    await this.insightRepository.update(id, { isActioned: true });
    return this.findById(id);
  }

  async findCriticalInsights(tenantId: string): Promise<Insight[]> {
    return this.insightRepository
      .createQueryBuilder('insight')
      .where('insight.tenantId = :tenantId', { tenantId })
      .andWhere('insight.severity = :severity', { severity: InsightSeverity.CRITICAL })
      .andWhere('insight.isRead = false')
      .orderBy('insight.createdAt', 'DESC')
      .getMany();
  }

  async deleteOldInsights(tenantId: string, daysOld = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.insightRepository
      .createQueryBuilder()
      .delete()
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('isRead = true')
      .andWhere('isActioned = true')
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.insightRepository.delete(id);
  }
}
