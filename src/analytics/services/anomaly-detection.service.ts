import { Injectable, Logger } from '@nestjs/common';
import { OrderService, CustomerService } from '../../database/services';
import { AnalyticsService } from './analytics.service';
import { AnomalyScore, AnomalyType, Baseline, AnomalyDetectionConfig } from '../interfaces/anomaly.interface';

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  
  private readonly defaultConfig: AnomalyDetectionConfig = {
    revenueDropThreshold: 30,
    revenueSpikeThreshold: 50,
    conversionDropThreshold: 20,
    aoVDropThreshold: 25,
    repeatCustomerDropThreshold: 15,
    minimumOrdersForAnalysis: 5,
    baselineWindow: 14, // 14-day baseline
  };

  constructor(
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Set custom anomaly detection thresholds
   */
  setConfig(config: Partial<AnomalyDetectionConfig>): void {
    Object.assign(this.defaultConfig, config);
    this.logger.log('Anomaly detection config updated', this.defaultConfig);
  }

  /**
   * Calculate baseline metrics for comparison
   */
  async calculateBaseline(
    tenantId: string,
    daysBack: number = this.defaultConfig.baselineWindow,
  ): Promise<Baseline> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    const metrics = await this.analyticsService.calculateMetrics(tenantId, startDate, now);

    return {
      revenue: metrics.totalRevenue,
      orders: metrics.totalOrders,
      averageOrderValue: metrics.averageOrderValue,
      conversionRate: metrics.conversionRate,
      repeatCustomers: metrics.repeatCustomers,
      period: metrics.period,
    };
  }

  /**
   * Get current period metrics (last 24 hours)
   */
  async getCurrentMetrics(tenantId: string): Promise<Baseline> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);

    const metrics = await this.analyticsService.calculateMetrics(tenantId, startDate, now);

    return {
      revenue: metrics.totalRevenue,
      orders: metrics.totalOrders,
      averageOrderValue: metrics.averageOrderValue,
      conversionRate: metrics.conversionRate,
      repeatCustomers: metrics.repeatCustomers,
      period: metrics.period,
    };
  }

  /**
   * Detect anomalies in current data
   */
  async detectAnomalies(tenantId: string): Promise<AnomalyScore[]> {
    this.logger.log(`Detecting anomalies for tenant ${tenantId}`);

    try {
      const baseline = await this.calculateBaseline(tenantId);
      const current = await this.getCurrentMetrics(tenantId);
      const anomalies: AnomalyScore[] = [];

      // Skip analysis if not enough orders
      if (baseline.orders < this.defaultConfig.minimumOrdersForAnalysis) {
        this.logger.log(`Tenant ${tenantId} has insufficient data for analysis`);
        return anomalies;
      }

      // Check revenue anomalies
      const revenueAnomalyScore = this.checkMetricAnomaly(
        current.revenue,
        baseline.revenue,
        this.defaultConfig.revenueDropThreshold,
        this.defaultConfig.revenueSpikeThreshold,
      );

      if (revenueAnomalyScore) {
        const type = revenueAnomalyScore.percentageChange < 0 
          ? AnomalyType.REVENUE_DROP 
          : AnomalyType.REVENUE_SPIKE;
        anomalies.push({
          ...revenueAnomalyScore,
          type,
          message: `Revenue ${type === AnomalyType.REVENUE_DROP ? 'dropped' : 'spiked'} by ${Math.abs(revenueAnomalyScore.percentageChange).toFixed(1)}% from baseline of $${revenueAnomalyScore.baseline.toFixed(2)}`,
        });
      }

      // Check conversion rate anomalies
      if (baseline.orders > 0 && current.orders > 0) {
        const currentConversion = current.orders;
        const baselineConversion = baseline.orders;

        const conversionAnomalyScore = this.checkMetricAnomaly(
          currentConversion,
          baselineConversion,
          this.defaultConfig.conversionDropThreshold,
          20, // No upper threshold for conversion
        );

        if (conversionAnomalyScore) {
          anomalies.push({
            ...conversionAnomalyScore,
            type: AnomalyType.CONVERSION_DROP,
            message: `Conversion rate dropped by ${Math.abs(conversionAnomalyScore.percentageChange).toFixed(1)}% from baseline`,
          });
        }
      }

      // Check AOV anomalies
      if (baseline.averageOrderValue > 0 && current.averageOrderValue > 0) {
        const aovAnomalyScore = this.checkMetricAnomaly(
          current.averageOrderValue,
          baseline.averageOrderValue,
          this.defaultConfig.aoVDropThreshold,
          30,
        );

        if (aovAnomalyScore) {
          const type = aovAnomalyScore.percentageChange < 0 
            ? AnomalyType.AOV_DROP 
            : AnomalyType.AOV_SPIKE;
          anomalies.push({
            ...aovAnomalyScore,
            type,
            message: `Average Order Value ${type === AnomalyType.AOV_DROP ? 'dropped' : 'increased'} by ${Math.abs(aovAnomalyScore.percentageChange).toFixed(1)}%`,
          });
        }
      }

      // Check repeat customer anomalies
      if (baseline.repeatCustomers > 0) {
        const repeatAnomalyScore = this.checkMetricAnomaly(
          current.repeatCustomers,
          baseline.repeatCustomers,
          this.defaultConfig.repeatCustomerDropThreshold,
          20,
        );

        if (repeatAnomalyScore) {
          anomalies.push({
            ...repeatAnomalyScore,
            type: AnomalyType.REPEAT_CUSTOMER_DROP,
            message: `Repeat customers dropped by ${Math.abs(repeatAnomalyScore.percentageChange).toFixed(1)}%`,
          });
        }
      }

      this.logger.log(`Found ${anomalies.length} anomalies for tenant ${tenantId}`);
      return anomalies;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error detecting anomalies: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Check if a metric has an anomaly based on thresholds
   */
  private checkMetricAnomaly(
    current: number,
    baseline: number,
    dropThreshold: number,
    spikeThreshold: number,
  ): AnomalyScore | null {
    if (baseline === 0) {
      return null;
    }

    const percentageChange = ((current - baseline) / baseline) * 100;
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let isAnomaly = false;

    // Check for drop
    if (percentageChange < -dropThreshold) {
      isAnomaly = true;
      if (percentageChange < -dropThreshold * 2) {
        severity = 'critical';
      } else if (percentageChange < -dropThreshold * 1.5) {
        severity = 'high';
      } else {
        severity = 'medium';
      }
    }
    // Check for spike
    else if (percentageChange > spikeThreshold) {
      isAnomaly = true;
      if (percentageChange > spikeThreshold * 2) {
        severity = 'high';
      } else {
        severity = 'medium';
      }
    }

    if (!isAnomaly) {
      return null;
    }

    return {
      type: AnomalyType.UNUSUAL_PATTERN, // Default type, will be overridden by caller
      severity,
      value: current,
      baseline,
      current,
      percentageChange: Math.round(percentageChange * 10) / 10,
      message: 'Unusual pattern detected',
    };
  }

  /**
   * Detect seasonality patterns (e.g., weekends vs weekdays)
   */
  async detectSeasonality(tenantId: string): Promise<Map<string, number>> {
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 60);

      const orders = await this.orderService.findOrdersInDateRange(tenantId, startDate, now);

      const dailyRevenue = new Map<string, number>();

      orders.forEach((order) => {
        const dateKey = order.createdAt.toISOString().split('T')[0];
        const current = dailyRevenue.get(dateKey) || 0;
        dailyRevenue.set(dateKey, current + parseFloat(order.totalAmount?.toString() || '0'));
      });

      return dailyRevenue;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error detecting seasonality: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Get anomaly severity badge
   */
  getSeverityBadge(severity: string): string {
    const badges: Record<string, string> = {
      'critical': '🔴 CRITICAL',
      'high': '🟠 HIGH',
      'medium': '🟡 MEDIUM',
      'low': '🟢 LOW',
    };
    return badges[severity] || 'UNKNOWN';
  }
}
