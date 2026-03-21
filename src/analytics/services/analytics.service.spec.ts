import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { OrderService, CustomerService } from '../../database/services';

const makeOrder = (totalAmount: string, createdAt: Date, customerId?: string) => ({
  id: Math.random().toString(36).slice(2),
  totalAmount,
  createdAt,
  customerId: customerId ?? null,
  items: [],
});

const makeCustomer = (lifetimeValue: string, totalOrders: number, createdAt: Date) => ({
  id: Math.random().toString(36).slice(2),
  lifetimeValue,
  totalOrders,
  createdAt,
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let orderService: jest.Mocked<OrderService>;
  let customerService: jest.Mocked<CustomerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: OrderService,
          useValue: {
            findOrdersInDateRange: jest.fn(),
          },
        },
        {
          provide: CustomerService,
          useValue: {
            findByTenantId: jest.fn(),
            findTopCustomers: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    orderService = module.get(OrderService);
    customerService = module.get(CustomerService);
  });

  // ─── calculateMetrics ──────────────────────────────────────────────────────

  describe('calculateMetrics', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);

    it('should return zeros when no data', async () => {
      orderService.findOrdersInDateRange.mockResolvedValue([]);
      customerService.findByTenantId.mockResolvedValue({ data: [], total: 0 });

      const result = await service.calculateMetrics('t1', start, now);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.averageOrderValue).toBe(0);
      expect(result.totalCustomers).toBe(0);
    });

    it('should calculate revenue and AOV correctly', async () => {
      const orders = [
        makeOrder('100.00', new Date()),
        makeOrder('200.50', new Date()),
        makeOrder('50.25', new Date()),
      ];
      orderService.findOrdersInDateRange.mockResolvedValue(orders as any);
      customerService.findByTenantId.mockResolvedValue({ data: [], total: 0 });

      const result = await service.calculateMetrics('t1', start, now);

      expect(result.totalRevenue).toBe(350.75);
      expect(result.totalOrders).toBe(3);
      expect(result.averageOrderValue).toBeCloseTo(116.92, 1);
    });

    it('should count repeat customers', async () => {
      const customers = [
        makeCustomer('500', 3, new Date()),
        makeCustomer('200', 1, new Date()),
        makeCustomer('800', 5, new Date()),
      ];
      orderService.findOrdersInDateRange.mockResolvedValue([]);
      customerService.findByTenantId.mockResolvedValue({ data: customers as any, total: 3 });

      const result = await service.calculateMetrics('t1', start, now);

      expect(result.totalCustomers).toBe(3);
      expect(result.repeatCustomers).toBe(2); // customers with totalOrders > 1
    });
  });

  // ─── calculateMonthlyGrowth ────────────────────────────────────────────────

  describe('calculateMonthlyGrowth', () => {
    it('should return an array of the requested length', async () => {
      orderService.findOrdersInDateRange.mockResolvedValue([]);

      const result = await service.calculateMonthlyGrowth('t1', 4);

      expect(result).toHaveLength(4);
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('revenue');
      expect(result[0]).toHaveProperty('orders');
    });

    it('should aggregate revenue per month', async () => {
      orderService.findOrdersInDateRange
        .mockResolvedValueOnce([makeOrder('100', new Date()), makeOrder('200', new Date())] as any)
        .mockResolvedValue([]);

      const result = await service.calculateMonthlyGrowth('t1', 3);

      const firstMonth = result[0];
      expect(firstMonth.revenue).toBe(300);
      expect(firstMonth.orders).toBe(2);
    });
  });

  // ─── calculateAverageLTV ───────────────────────────────────────────────────

  describe('calculateAverageLTV', () => {
    it('should return 0 when no customers', async () => {
      customerService.findByTenantId.mockResolvedValue({ data: [], total: 0 });

      const result = await service.calculateAverageLTV('t1');

      expect(result).toBe(0);
    });

    it('should compute average lifetime value correctly', async () => {
      const customers = [
        makeCustomer('300.00', 3, new Date()),
        makeCustomer('100.00', 1, new Date()),
      ];
      customerService.findByTenantId.mockResolvedValue({ data: customers as any, total: 2 });

      const result = await service.calculateAverageLTV('t1');

      expect(result).toBe(200);
    });
  });

  // ─── forecastRevenue ───────────────────────────────────────────────────────

  describe('forecastRevenue', () => {
    it('should return history + forecast arrays', async () => {
      orderService.findOrdersInDateRange.mockResolvedValue([]);

      const result = await service.forecastRevenue('t1', 7, 30);

      expect(result.history).toHaveLength(30);
      expect(result.forecast).toHaveLength(7);
      expect(result.trend).toMatch(/^(up|down|flat)$/);
    });

    it('should detect upward trend with increasing revenue', async () => {
      const orders = Array.from({ length: 90 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (89 - i));
        return makeOrder(String(i * 10), d); // revenue increases each day
      });
      orderService.findOrdersInDateRange.mockResolvedValue(orders as any);

      const result = await service.forecastRevenue('t1', 14, 90);

      expect(result.trend).toBe('up');
    });
  });
});
