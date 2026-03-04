import { Injectable, Logger } from '@nestjs/common';
import { OrderService, CustomerService } from '../../database/services';
import { Order } from '../../database/entities';

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  repeatCustomers: number;
  conversionRate: number;
  totalProductQty: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

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
      const { data: customers } = await this.customerService.findByTenantId(tenantId, 0, 10000);

      // Calculate metrics
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount?.toString() || '0'), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalCustomers = customers.length;
      const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length;
      const conversionRate = totalOrders; // Placeholder - would need visitor data
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
      const { data: orders } = await this.orderService.findByStoreId(storeId, 0, 10000);
      const filteredOrders = orders.filter(
        (o) => o.createdAt >= startDate && o.createdAt <= endDate,
      );

      // Get customers for store
      const { data: customers } = await this.customerService.findByStoreId(storeId, 0, 10000);

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
    const { data: customers } = await this.customerService.findByTenantId(tenantId, 0, 10000);
    
    if (customers.length === 0) {
      return 0;
    }

    const totalLTV = customers.reduce((sum, c) => sum + parseFloat(c.lifetimeValue?.toString() || '0'), 0);
    return Math.round((totalLTV / customers.length) * 100) / 100;
  }
}
