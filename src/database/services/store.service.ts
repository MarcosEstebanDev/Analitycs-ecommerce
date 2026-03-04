import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store, StoreProvider } from '../entities';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async create(
    tenantId: string,
    provider: StoreProvider,
    name: string,
    externalId: string,
    accessToken: string,
    refreshToken?: string,
  ): Promise<Store> {
    const store = this.storeRepository.create({
      tenantId,
      provider,
      name,
      externalId,
      accessToken,
      refreshToken,
    });
    return this.storeRepository.save(store);
  }

  async findById(id: string): Promise<Store | null> {
    return this.storeRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
  }

  async findByExternalId(tenantId: string, externalId: string, provider: StoreProvider): Promise<Store | null> {
    return this.storeRepository.findOne({
      where: { tenantId, externalId, provider },
    });
  }

  async findByTenantId(tenantId: string): Promise<Store[]> {
    return this.storeRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updates: Partial<Store>): Promise<Store | null> {
    await this.storeRepository.update(id, updates as any);
    return this.findById(id);
  }

  async updateLastSync(id: string): Promise<Store | null> {
    await this.storeRepository.update(id, { lastSyncedAt: new Date() });
    return this.findById(id);
  }

  async incrementOrdersSync(id: string, count: number): Promise<Store | null> {
    const store = await this.findById(id);
    if (store) {
      await this.storeRepository.update(id, {
        totalOrdersSync: store.totalOrdersSync + count,
      });
    }
    return this.findById(id);
  }

  async deactivate(id: string): Promise<Store | null> {
    await this.storeRepository.update(id, { isActive: false });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.storeRepository.delete(id);
  }
}
