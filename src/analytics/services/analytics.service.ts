import { Injectable, Logger } from '@nestjs/common';
import { OrderService, CustomerService } from '../../database/services';
import { Order } from '../../database/entities';

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  repeatCustomers: number;
  /** Placeholder: total orders in period (real conversion rate requires visitor tracking) */
  conversionRate: number;
  totalProductQty: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

const MAX_QUERY_ROWS = 50_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
  ) {}

  /**
   * Calculate key metrics for a tenant within a date range
   */
  async calculateMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsMetrics> {
    this.logger.log(`Calculating metrics for tenant ${tenantId} from ${startDate} to ${endDate}`);

    try {
      // Get all orders in date range
      const orders = await this.orderService.findOrdersInDateRange(tenantId, startDate, endDate);

      // Get all customers
      const { data: customers } = await this.customerService.findByTenantId(tenantId, 0, MAX_QUERY_ROWS);

      // Calculate metrics
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount?.toString() || '0'), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalCustomers = customers.length;
      const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length;
      const conversionRate = totalOrders; // Placeholder: orders count until visitor tracking is implemented
      const totalProductQty = orders.reduce((sum, order) => {
        return sum + (order.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
      }, 0);

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        totalCustomers,
        repeatCustomers,
        conversionRate,
        totalProductQty,
        period: { startDate, endDate },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error calculating metrics: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Calculate metrics for a specific store
   */
  async calculateStoreMetrics(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsMetrics> {
    this.logger.log(`Calculating metrics for store ${storeId}`);

    try {
      // Get orders for store in date range
      const { data: orders } = await this.orderService.findByStoreId(storeId, 0, MAX_QUERY_ROWS);
      const filteredOrders = orders.filter(
        (o) => o.createdAt >= startDate && o.createdAt <= endDate,
      );

      // Get customers for store
      const { data: customers } = await this.customerService.findByStoreId(storeId, 0, MAX_QUERY_ROWS);

      const totalRevenue = filteredOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount?.toString() || '0'), 0);
      const totalOrders = filteredOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalCustomers = customers.length;
      const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length;
      const totalProductQty = filteredOrders.reduce((sum, order) => {
        return sum + (order.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
      }, 0);

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        totalCustomers,
        repeatCustomers,
        conversionRate: totalOrders,
        totalProductQty,
        period: { startDate, endDate },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error calculating store metrics: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Calculate month-over-month growth
   */
  async calculateMonthlyGrowth(tenantId: string, months = 6): Promise<Array<{ month: string; revenue: number; orders: number }>> {
    const metrics = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(
        i === 0 ? now.getFullYear() : startDate.getFullYear(),
        i === 0 ? now.getMonth() + 1 : startDate.getMonth() + 1,
        0,
      );

      const orders = await this.orderService.findOrdersInDateRange(tenantId, startDate, endDate);
      const revenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount?.toString() || '0'), 0);

      metrics.push({
        month: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Math.round(revenue * 100) / 100,
        orders: orders.length,
      });
    }

    return metrics;
  }

  /**
   * Calculate growth with configurable granularity: 'day', 'week', or 'month'.
   * Uses a single DB query and groups results in-memory to avoid N+1 queries.
   */
  async calculateGrowthByGranularity(
    tenantId: string,
    days: number,
    granularity: 'day' | 'week' | 'month',
  ): Promise<Array<{ month: string; revenue: number; orders: number }>> {
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - days);
    rangeStart.setHours(0, 0, 0, 0);

    // Single query for the whole range
    const allOrders = await this.orderService.findOrdersInDateRange(tenantId, rangeStart, now);

    if (granularity === 'day') {
      const buckets = new Map<string, { revenue: number; orders: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        buckets.set(key, { revenue: 0, orders: 0 });
      }
      for (const order of allOrders) {
        const d = new Date(order.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.revenue += parseFloat(order.totalAmount?.toString() || '0');
          bucket.orders += 1;
        }
      }
      return Array.from(buckets.entries()).map(([key, val]) => {
        const d = new Date(key + 'T12:00:00');
        return {
          month: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
          revenue: Math.round(val.revenue * 100) / 100,
          orders: val.orders,
        };
      });
    }

    if (granularity === 'week') {
      const weeks = Math.ceil(days / 7);
      return Array.from({ length: weeks }, (_, idx) => {
        const i = weeks - 1 - idx;
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        if (weekStart < rangeStart) weekStart.setTime(rangeStart.getTime());

        const weekOrders = allOrders.filter((o) => {
          const d = new Date(o.createdAt);
          return d >= weekStart && d <= weekEnd;
        });
        const revenue = weekOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount?.toString() || '0'), 0);
        return {
          month: weekStart.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
          revenue: Math.round(revenue * 100) / 100,
          orders: weekOrders.length,
        };
      });
    }

    // 'month' fallback
    return this.calculateMonthlyGrowth(tenantId, Math.ceil(days / 30));
  }

  /**
   * Get top customers by LTV
   */
  async getTopCustomers(tenantId: string, limit = 10) {
    return this.customerService.findTopCustomers(tenantId, limit);
  }

  /**
   * Calculate customer acquisition cost (CAC) estimate
   */
  async estimateCAC(tenantId: string, monthlyMarketingSpend = 1000): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: customers } = await this.customerService.findByTenantId(tenantId);
    
    const newCustomersThisMonth = customers.filter((c) => c.createdAt >= startOfMonth).length;

    return newCustomersThisMonth > 0
      ? Math.round((monthlyMarketingSpend / newCustomersThisMonth) * 100) / 100
      : 0;
  }

  /**
   * Calculate average customer lifetime value
   */
  async calculateAverageLTV(tenantId: string): Promise<number> {
    const { data: customers } = await this.customerService.findByTenantId(tenantId, 0, MAX_QUERY_ROWS);
    
    if (customers.length === 0) {
      return 0;
    }

    const totalLTV = customers.reduce((sum, c) => sum + parseFloat(c.lifetimeValue?.toString() || '0'), 0);
    return Math.round((totalLTV / customers.length) * 100) / 100;
  }

  /**
   * Calculate cohort retention matrix.
   * Groups customers by first-purchase month (cohort), then tracks what percentage
   * came back to purchase in subsequent months.
   * Returns an array of cohorts, each with a `retention` array of percentages.
   *
   * @param tenantId - tenant identifier
   * @param months   - how many months back to build cohorts (default 6)
   */
  async calculateCohortRetention(
    tenantId: string,
    months = 6,
  ): Promise<{
    cohorts: Array<{
      cohortMonth: string;   // e.g. "Jan 2024"
      size: number;          // number of new customers in this cohort
      retention: number[];   // index 0 = month 0 (always 100%), index N = month N retention %
    }>;
    maxPeriods: number;
  }> {
    const now = new Date();
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Fetch all orders within our analysis window
    const orders = await this.orderService.findOrdersInDateRange(tenantId, cohortStart, now);

    // Build customerId -> set of month indices where they ordered
    const customerMonths = new Map<string, Set<number>>();
    for (const order of orders) {
      if (!order.customerId) continue;
      const orderDate = new Date(order.createdAt);
      const monthIndex = orderDate.getFullYear() * 12 + orderDate.getMonth();
      if (!customerMonths.has(order.customerId)) {
        customerMonths.set(order.customerId, new Set());
      }
      customerMonths.get(order.customerId)!.add(monthIndex);
    }

    // First purchase month for each customer (within our window)
    const firstOrderMonth = new Map<string, number>();
    for (const [customerId, monthSet] of customerMonths) {
      firstOrderMonth.set(customerId, Math.min(...monthSet));
    }

    const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();

    const cohorts = [];
    for (let i = 0; i < months; i++) {
      const cohortDate = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const cohortMonthIndex = cohortDate.getFullYear() * 12 + cohortDate.getMonth();
      const periodsAvailable = currentMonthIndex - cohortMonthIndex + 1;

      const cohortCustomers = Array.from(firstOrderMonth.entries())
        .filter(([, fm]) => fm === cohortMonthIndex)
        .map(([id]) => id);

      if (cohortCustomers.length === 0) {
        cohorts.push({
          cohortMonth: cohortDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          size: 0,
          retention: Array(periodsAvailable).fill(0),
        });
        continue;
      }

      const retention: number[] = [];
      for (let p = 0; p < periodsAvailable; p++) {
        const targetMonth = cohortMonthIndex + p;
        if (p === 0) {
          retention.push(100);
        } else {
          const active = cohortCustomers.filter((cId) =>
            customerMonths.get(cId)?.has(targetMonth),
          ).length;
          retention.push(Math.round((active / cohortCustomers.length) * 100));
        }
      }

      cohorts.push({
        cohortMonth: cohortDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        size: cohortCustomers.length,
        retention,
      });
    }

    return { cohorts, maxPeriods: months };
  }

  /**
   * Simple linear regression revenue forecast.
   * Uses the past `historyDays` days of daily revenue to project `forecastDays` ahead.
   *
   * @param tenantId    - tenant identifier
   * @param forecastDays - days to forecast into the future (default 30)
   * @param historyDays  - days of history to use for regression (default 90)
   */
  async forecastRevenue(
    tenantId: string,
    forecastDays = 30,
    historyDays = 90,
  ): Promise<{
    history: Array<{ date: string; revenue: number }>;
    forecast: Array<{ date: string; predictedRevenue: number; lower: number; upper: number }>;
    trend: 'up' | 'down' | 'flat';
  }> {
    const now = new Date();
    const historyStart = new Date(now);
    historyStart.setDate(historyStart.getDate() - historyDays);

    const orders = await this.orderService.findOrdersInDateRange(tenantId, historyStart, now);

    // Aggregate daily revenue
    const dailyRevenue = new Map<string, number>();
    for (let d = 0; d < historyDays; d++) {
      const date = new Date(historyStart);
      date.setDate(date.getDate() + d);
      dailyRevenue.set(date.toISOString().slice(0, 10), 0);
    }

    for (const order of orders) {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      if (dailyRevenue.has(dateKey)) {
        dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) ?? 0) + parseFloat(order.totalAmount?.toString() || '0'));
      }
    }

    const history = Array.from(dailyRevenue.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }));

    // Linear regression: y = a + bx
    const n = history.length;
    const xs = history.map((_, i) => i);
    const ys = history.map((h) => h.revenue);

    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;

    const ssXY = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const ssXX = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);

    const b = ssXX !== 0 ? ssXY / ssXX : 0; // slope
    const a = yMean - b * xMean;             // intercept

    // Residual std deviation for confidence bands
    const residuals = ys.map((y, i) => y - (a + b * xs[i]));
    const residualVariance = residuals.reduce((s, r) => s + r ** 2, 0) / Math.max(n - 2, 1);
    const stdDev = Math.sqrt(residualVariance);

    // Build forecast
    const forecast = [];
    for (let d = 1; d <= forecastDays; d++) {
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + d);
      const x = n + d - 1;
      const predicted = Math.max(0, Math.round((a + b * x) * 100) / 100);
      const margin = Math.round(stdDev * 1.96 * 100) / 100; // 95% CI
      forecast.push({
        date: futureDate.toISOString().slice(0, 10),
        predictedRevenue: predicted,
        lower: Math.max(0, Math.round((predicted - margin) * 100) / 100),
        upper: Math.round((predicted + margin) * 100) / 100,
      });
    }

    const trend: 'up' | 'down' | 'flat' =
      b > 0.5 ? 'up' : b < -0.5 ? 'down' : 'flat';

    return { history, forecast, trend };
  }
}
