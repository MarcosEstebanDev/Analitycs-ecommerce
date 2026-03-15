import { Body, Controller, Get, Param, Post, BadRequestException } from '@nestjs/common';
import { TenantService, StoreService } from '../database/services';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateStoreDto } from './dto/create-store.dto';

@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly storeService: StoreService,
  ) {}

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    const existing = await this.tenantService.findBySlug(body.slug);
    if (existing) {
      throw new BadRequestException('Tenant slug already in use');
    }

    const tenant = await this.tenantService.create(body.name, body.slug, body.plan);
    return { success: true, data: tenant };
  }

  @Get()
  async listTenants() {
    const tenants = await this.tenantService.findAll();
    return { success: true, data: tenants };
  }

  @Get(':tenantId')
  async getTenant(@Param('tenantId') tenantId: string) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }
    const stores = await this.storeService.findByTenantId(tenantId);
    return { success: true, data: { tenant, stores } };
  }

  @Post(':tenantId/stores')
  async createStore(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateStoreDto,
  ) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const existingStore = await this.storeService.findByExternalId(
      tenantId,
      body.externalId,
      body.provider,
    );

    if (existingStore) {
      throw new BadRequestException('Store already exists for this tenant');
    }

    const store = await this.storeService.create(
      tenantId,
      body.provider,
      body.name,
      body.externalId,
      body.accessToken,
      body.refreshToken,
    );

    return { success: true, data: store };
  }

  @Get(':tenantId/stores')
  async listStores(@Param('tenantId') tenantId: string) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }
    const stores = await this.storeService.findByTenantId(tenantId);
    return { success: true, data: stores };
  }
}
