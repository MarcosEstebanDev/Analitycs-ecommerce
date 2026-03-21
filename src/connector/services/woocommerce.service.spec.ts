import { Test, TestingModule } from '@nestjs/testing';
import { WooCommerceService } from './woocommerce.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import {
  OrderService,
  CustomerService,
  StoreService,
  InsightService,
  TenantService,
} from '../../database/services';
import { StoreProvider, TenantPlan, OrderStatus } from '../../database/entities';
import { WooOrderPayload } from '../dto/woocommerce-order.dto';

const mockTenant = { id: 'tenant-1', plan: TenantPlan.FREE };

const mockStore = {
  id: 'store-1',
  tenantId: 'tenant-1',
  externalId: 'https://mi-tienda.com',
  provider: StoreProvider.WOOCOMMERCE,
  name: 'mi-tienda.com',
  accessToken: 'encoded',
};

const buildWooPayload = (overrides: Partial<WooOrderPayload> = {}): WooOrderPayload => ({
  id: 1001,
  number: '#1001',
  status: 'processing',
  currency: 'ARS',
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  total: '250.00',
  subtotal: '230.00',
  total_tax: '20.00',
  billing: { first_name: 'María', last_name: 'García', email: 'maria@example.com' },
  shipping_lines: [{ total: '10.00' }],
  discount_total: '5.00',
  line_items: [{ id: 1, product_id: 99, name: 'Producto A', price: 230, quantity: 1 }],
  customer_id: 42,
  customer_note: '',
  ...overrides,
});

describe('WooCommerceService', () => {
  let service: WooCommerceService;
  let orderService: jest.Mocked<OrderService>;
  let customerService: jest.Mocked<CustomerService>;
  let storeService: jest.Mocked<StoreService>;
  let insightService: jest.Mocked<InsightService>;
  let tenantService: jest.Mocked<TenantService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WooCommerceService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
        },
        {
          provide: OrderService,
          useValue: {
            countOrdersForTenantInMonth: jest.fn().mockResolvedValue(0),
            findByExternalId: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'order-uuid' }),
            updateStatus: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: CustomerService,
          useValue: {
            findByExternalId: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'customer-uuid' }),
            incrementMetrics: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: StoreService,
          useValue: {
            findByExternalId: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockStore),
            update: jest.fn().mockResolvedValue(mockStore),
            incrementOrdersSync: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: InsightService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: TenantService,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockTenant),
          },
        },
      ],
    }).compile();

    service = module.get<WooCommerceService>(WooCommerceService);
    orderService = module.get(OrderService);
    customerService = module.get(CustomerService);
    storeService = module.get(StoreService);
    insightService = module.get(InsightService);
    tenantService = module.get(TenantService);
  });

  // ─── connectStore ──────────────────────────────────────────────────────────

  describe('connectStore', () => {
    it('should create a new store when one does not exist', async () => {
      storeService.findByExternalId.mockResolvedValue(null);

      const result = await service.connectStore(
        'tenant-1',
        'https://mi-tienda.com',
        'ck_abc123',
        'cs_secret123',
      );

      expect(storeService.create).toHaveBeenCalledWith(
        'tenant-1',
        StoreProvider.WOOCOMMERCE,
        'mi-tienda.com',
        'https://mi-tienda.com',
        expect.any(String), // base64 encoded credentials
      );
      expect(result).toEqual(mockStore);
    });

    it('should update an existing store', async () => {
      storeService.findByExternalId.mockResolvedValue(mockStore as any);

      const result = await service.connectStore(
        'tenant-1',
        'https://mi-tienda.com',
        'ck_newkey',
        'cs_newsecret',
      );

      expect(storeService.update).toHaveBeenCalled();
      expect(storeService.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockStore);
    });

    it('should throw BadRequestException when tenantId is missing', async () => {
      await expect(
        service.connectStore('', 'https://mi-tienda.com', 'ck_key', 'cs_sec'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when siteUrl is missing', async () => {
      await expect(service.connectStore('tenant-1', '', 'ck_key', 'cs_sec')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── processOrderCreated ───────────────────────────────────────────────────

  describe('processOrderCreated', () => {
    it('should create order and customer for a new order', async () => {
      const payload = buildWooPayload();

      await service.processOrderCreated('tenant-1', 'store-1', payload);

      expect(customerService.create).toHaveBeenCalledWith(
        'tenant-1',
        'store-1',
        '42',
        'maria@example.com',
        'María',
        'García',
      );
      expect(orderService.create).toHaveBeenCalledWith(
        'tenant-1',
        'store-1',
        '1001',
        250,
        expect.objectContaining({ status: OrderStatus.CONFIRMED }),
      );
      expect(storeService.incrementOrdersSync).toHaveBeenCalledWith('store-1', 1);
    });

    it('should skip duplicate orders', async () => {
      orderService.findByExternalId.mockResolvedValue({ id: 'existing-order' } as any);
      const payload = buildWooPayload();

      await service.processOrderCreated('tenant-1', 'store-1', payload);

      expect(orderService.create).not.toHaveBeenCalled();
    });

    it('should create insight for high-value orders (>500)', async () => {
      const payload = buildWooPayload({ total: '750.00' });

      await service.processOrderCreated('tenant-1', 'store-1', payload);

      expect(insightService.create).toHaveBeenCalled();
    });

    it('should not create insight for low-value orders', async () => {
      const payload = buildWooPayload({ total: '49.99' });

      await service.processOrderCreated('tenant-1', 'store-1', payload);

      expect(insightService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when tenant not found', async () => {
      tenantService.findById.mockResolvedValue(null);

      await expect(
        service.processOrderCreated('bad-tenant', 'store-1', buildWooPayload()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── validateWebhook ───────────────────────────────────────────────────────

  describe('validateWebhook', () => {
    it('should return true in development (skip validation)', () => {
      const result = service.validateWebhook('{"id":1}', undefined);
      expect(result).toBe(true); // development mode always passes
    });
  });
});
