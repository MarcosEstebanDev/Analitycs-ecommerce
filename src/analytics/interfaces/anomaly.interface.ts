/**
 * Anomaly Detection Interfaces
 */

export interface Baseline {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  conversionRate: number;
  repeatCustomers: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface AnomalyScore {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  baseline: number;
  current: number;
  percentageChange: number;
  message: string;
}

export enum AnomalyType {
  REVENUE_DROP = 'revenue_drop',
  REVENUE_SPIKE = 'revenue_spike',
  CONVERSION_DROP = 'conversion_drop',
  CONVERSION_SPIKE = 'conversion_spike',
  AOV_DROP = 'aov_drop',
  AOV_SPIKE = 'aov_spike',
  REPEAT_CUSTOMER_DROP = 'repeat_customer_drop',
  UNUSUAL_PATTERN = 'unusual_pattern',
}

export interface AnomalyDetectionConfig {
  revenueDropThreshold: number; // 30 = 30% drop
  revenueSpikeThreshold: number; // 50 = 50% spike
  conversionDropThreshold: number; // 20 = 20% drop
  aoVDropThreshold: number; // 25 = 25% drop
  repeatCustomerDropThreshold: number; // 15 = 15% drop
  minimumOrdersForAnalysis: number; // Minimum orders needed for valid analysis
  baselineWindow: number; // Days to look back for baseline (7, 14, 30)
}
