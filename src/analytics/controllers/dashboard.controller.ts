import { Controller, Get, Post, Delete, Param, Query, Req, BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { AnalyticsService, AnomalyDetectionService, AlertService } from '../services';
import { InsightService, StoreService } from '../../database/services';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly alertService: AlertService,
    private readonly insightService: InsightService,
    private readonly storeService: StoreService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get stores for the current authenticated tenant
   */
  @Get('stores')
  async getStores(@Req() req: Request) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');
    const stores = await this.storeService.findByTenantId(tenantId);
    return { success: true, data: stores };
  }

  /**
   * Get current metrics for the dashboard
   * Query params:
   * - days: number of days to look back (default: 30)
   * - storeId: (optional) specific store ID
   */
  @Get('metrics')
  async getMetrics(
    @Req() req: Request,
    @Query('days') days: string = '30',
    @Query('storeId') storeId?: string,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const daysNum = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysNum);

      let metrics;
      if (storeId) {
        metrics = await this.analyticsService.calculateStoreMetrics(storeId, startDate, now);
      } else {
        metrics = await this.analyticsService.calculateMetrics(tenantId, startDate, now);
      }

      return {
        success: true,
        data: metrics,
        period: {
          startDate,
          endDate: now,
          days: daysNum,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching metrics: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get month-over-month growth comparison
   */
  @Get('growth')
  async getGrowth(
    @Req() req: Request,
    @Query('months') months: string = '6',
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const monthsNum = Math.min(Math.max(parseInt(months, 10) || 6, 1), 24);
      const growth = await this.analyticsService.calculateMonthlyGrowth(tenantId, monthsNum);

      return {
        success: true,
        data: growth,
        months: monthsNum,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching growth: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get key insights and alerts
   */
  @Get('insights')
  async getInsights(
    @Req() req: Request,
    @Query('limit') limit: string = '20',
    @Query('unreadOnly') unreadOnly: string = 'false',
    @Query('storeId') storeId?: string,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const unread = unreadOnly === 'true';

      let insights;
      if (storeId) {
        insights = await this.insightService.findByStoreId(storeId, 0, limitNum, unread);
      } else {
        insights = await this.insightService.findByTenantId(tenantId, 0, limitNum, unread);
      }

      // Get critical alerts
      const criticalAlerts = await this.alertService.getActiveAlerts(tenantId);

      return {
        success: true,
        data: {
          insights: insights.data,
          critical: criticalAlerts,
          total: insights.total,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching insights: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get top customers by LTV
   */
  @Get('top-customers')
  async getTopCustomers(
    @Req() req: Request,
    @Query('limit') limit: string = '10',
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      const customers = await this.analyticsService.getTopCustomers(tenantId, limitNum);

      return {
        success: true,
        data: customers,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching top customers: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get anomaly detection baseline and calculate current anomalies
   */
  @Get('anomalies')
  async getAnomalies(
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const baseline = await this.anomalyDetectionService.calculateBaseline(tenantId);
      const current = await this.anomalyDetectionService.getCurrentMetrics(tenantId);
      const anomalies = await this.anomalyDetectionService.detectAnomalies(tenantId);

      return {
        success: true,
        data: {
          baseline,
          current,
          anomalies,
          anomalyCount: anomalies.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching anomalies: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get CAC estimation
   */
  @Get('cac')
  async getCAC(
    @Req() req: Request,
    @Query('monthlySpend') monthlySpend: string = '1000',
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const spend = Math.max(parseFloat(monthlySpend) || 1000, 0);
      const cac = await this.analyticsService.estimateCAC(tenantId, spend);
      const avgLTV = await this.analyticsService.calculateAverageLTV(tenantId);

      return {
        success: true,
        data: {
          cac,
          avgLTV,
          ltv_cac_ratio: avgLTV > 0 ? (avgLTV / cac).toFixed(2) : 'N/A',
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error calculating CAC: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Acknowledge/mark alert as read
   */
  @Post('insights/:insightId/read')
  async markInsightAsRead(
    @Req() req: Request,
    @Param('insightId') insightId: string,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      await this.alertService.acknowledgeAlert(insightId);
      return {
        success: true,
        message: `Insight ${insightId} marked as read`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error marking insight as read: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Mark alert as actioned
   */
  @Post('insights/:insightId/action')
  async actionInsight(
    @Req() req: Request,
    @Param('insightId') insightId: string,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      await this.alertService.actionAlert(insightId);
      return {
        success: true,
        message: `Insight ${insightId} marked as actioned`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error actioning insight: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * DELETE /dashboard/connectors/:storeId
   * Permanently removes a store/connector for the current tenant.
   */
  @Delete('connectors/:storeId')
  async deleteConnector(
    @Req() req: Request,
    @Param('storeId') storeId: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const stores = await this.storeService.findByTenantId(tenantId);
      const store = stores.find((s) => s.id === storeId);
      if (!store) throw new BadRequestException('Store not found');

      await this.storeService.delete(storeId);
      return { success: true, message: `Store ${store.name} deleted` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get connector/store status with sync details
   */
  @Get('connectors')
  async getConnectors(@Req() req: Request) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const stores = await this.storeService.findByTenantId(tenantId);

      // Enrich each store with order counts per time window
      const enriched = await Promise.all(
        stores.map(async (store) => {
          const [row] = await this.dataSource.query(
            `SELECT
               COUNT(*)::int              AS "totalOrders",
               MAX(o."createdAt")         AS "lastOrderAt"
             FROM orders o
             WHERE o."storeId" = $1`,
            [store.id],
          );
          const lastSync = store.lastSyncedAt ?? store.updatedAt;
          const minutesSinceSync = lastSync
            ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000)
            : null;

          return {
            id:               store.id,
            name:             store.name,
            provider:         store.provider,
            isActive:         store.isActive,
            externalId:       store.externalId,
            lastSyncedAt:     store.lastSyncedAt ?? null,
            totalOrdersSync:  Number(store.totalOrdersSync ?? 0),
            totalOrders:      row?.totalOrders ?? 0,
            lastOrderAt:      row?.lastOrderAt ?? null,
            minutesSinceSync: minutesSinceSync,
            status:           !store.isActive
              ? 'disconnected'
              : minutesSinceSync === null || minutesSinceSync > 120
              ? 'stale'
              : 'synced',
            createdAt:        store.createdAt,
          };
        }),
      );

      return { success: true, data: enriched };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching connectors: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Toggle store active/inactive
   */
  @Post('connectors/:storeId/toggle')
  async toggleConnector(
    @Req() req: Request,
    @Param('storeId') storeId: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const stores = await this.storeService.findByTenantId(tenantId);
      const store = stores.find((s) => s.id === storeId);
      if (!store) throw new BadRequestException('Store not found');

      await this.dataSource.query(
        `UPDATE stores SET "isActive" = NOT "isActive", "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`,
        [storeId, tenantId],
      );

      return {
        success: true,
        message: `Store ${store.name} toggled to ${!store.isActive ? 'active' : 'inactive'}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get top 10 products by revenue
   */
  @Get('top-products')
  async getTopProducts(@Req() req: Request) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const products = await this.dataSource.query(
        `SELECT oi."productName" AS title,
                SUM(oi.quantity)::int AS "totalQty",
                SUM(oi."lineTotal")::numeric AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi."orderId"
         WHERE o."tenantId" = $1
         GROUP BY oi."productName"
         ORDER BY revenue DESC
         LIMIT 10`,
        [tenantId],
      );

      return {
        success: true,
        data: {
          products: products.map((p: any) => ({
            title: p.title,
            totalQty: Number(p.totalQty),
            revenue: Number(p.revenue),
          })),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching top products: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get dashboard summary
   */
  @Get('summary')
  async getDashboardSummary(
    @Req() req: Request,
    @Query('days') days: string = '30',
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const daysNum = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysNum);

      const metrics = await this.analyticsService.calculateMetrics(tenantId, startDate, now);
      const anomalies = await this.anomalyDetectionService.detectAnomalies(tenantId);
      const { data: insights } = await this.insightService.findByTenantId(tenantId, 0, 5, true);
      const criticalAlerts = await this.alertService.getActiveAlerts(tenantId);
      const topCustomers = await this.analyticsService.getTopCustomers(tenantId, 5);
      const avgLTV = await this.analyticsService.calculateAverageLTV(tenantId);

      return {
        success: true,
        data: {
          metrics: {
            totalRevenue: metrics.totalRevenue,
            totalOrders: metrics.totalOrders,
            averageOrderValue: metrics.averageOrderValue,
            totalCustomers: metrics.totalCustomers,
            repeatCustomers: metrics.repeatCustomers,
          },
          anomalies: {
            count: anomalies.length,
            critical: anomalies.filter((a) => a.severity === 'critical').length,
            high: anomalies.filter((a) => a.severity === 'high').length,
          },
          alerts: {
            critical: criticalAlerts.length,
            unread: insights.length,
          },
          topCustomers: topCustomers.slice(0, 5),
          avgLTV,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating dashboard summary: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /dashboard/cohort-retention?months=6
   * Returns a customer retention cohort matrix.
   */
  @Get('cohort-retention')
  async getCohortRetention(
    @Req() req: Request,
    @Query('months') months: string = '6',
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const monthsNum = Math.min(Math.max(parseInt(months, 10) || 6, 1), 12);
      const data = await this.analyticsService.calculateCohortRetention(tenantId, monthsNum);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error calculating cohort retention: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * GET /dashboard/forecast?days=30&history=90
   * Returns a linear regression revenue forecast.
   */
  @Get('forecast')
  async getForecast(
    @Req() req: Request,
    @Query('days') days: string = '30',
    @Query('history') history: string = '90',
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    try {
      const forecastDays = Math.min(Math.max(parseInt(days, 10) || 30, 7), 90);
      const historyDays = Math.min(Math.max(parseInt(history, 10) || 90, 30), 365);
      const data = await this.analyticsService.forecastRevenue(tenantId, forecastDays, historyDays);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating forecast: ${message}`);
      return { success: false, error: message };
    }
  }
}
