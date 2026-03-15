import { Injectable, Logger } from '@nestjs/common';
import { InsightService } from '../../database/services';
import { InsightType, InsightSeverity } from '../../database/entities';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AnomalyScore } from '../interfaces/anomaly.interface';
import { NotificationService } from '../../notifications/services/notification.service';

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type: string; // 'anomaly_detected', 'metric_threshold', 'custom'
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number;
}

export interface AlertAction {
  type: 'create_insight' | 'send_email' | 'send_webhook' | 'slack';
  config: Record<string, unknown>;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly insightService: InsightService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Process anomalies and trigger alerts
   */
  async processAnomalies(tenantId: string, anomalies: AnomalyScore[], storeId?: string): Promise<void> {
    this.logger.log(`Processing ${anomalies.length} anomalies for tenant ${tenantId}`);

    for (const anomaly of anomalies) {
      await this.triggerAlertForAnomaly(tenantId, anomaly, storeId);
    }
  }

  /**
   * Create an alert from an anomaly
   */
  private async triggerAlertForAnomaly(
    tenantId: string,
    anomaly: AnomalyScore,
    storeId?: string,
  ): Promise<void> {
    try {
      const insightType = this.mapAnomalyToInsightType(anomaly.type);
      const severity = this.mapAnomalySeverityToInsightSeverity(anomaly.severity);

      const data = {
        anomalyType: anomaly.type,
        current: anomaly.current,
        baseline: anomaly.baseline,
        percentageChange: anomaly.percentageChange,
        detectedAt: new Date(),
      };

      const insight = await this.insightService.create(
        tenantId,
        insightType,
        anomaly.message,
        severity,
        data,
        storeId,
        `Anomaly detected: ${anomaly.message}. Current value: ${anomaly.current.toFixed(2)}, Baseline: ${anomaly.baseline.toFixed(2)}`,
      );

      this.logger.log(`Alert created for tenant ${tenantId}: ${anomaly.message}`);

      // Send notifications for critical anomalies
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        await this.notificationService.sendAlert(
          `🚨 ${anomaly.severity.toUpperCase()} Alert`,
          anomaly.message,
          data,
          ['webhook', 'slack'],
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating alert: ${message}`);
    }
  }

  /**
   * Map anomaly types to insight types
   */
  private mapAnomalyToInsightType(anomalyType: string): InsightType {
    const mapping: Record<string, InsightType> = {
      'revenue_drop': InsightType.REVENUE_ANOMALY,
      'revenue_spike': InsightType.REVENUE_ANOMALY,
      'conversion_drop': InsightType.CONVERSION_DROP,
      'conversion_spike': InsightType.REVENUE_ANOMALY,
      'aov_drop': InsightType.REVENUE_ANOMALY,
      'aov_spike': InsightType.HIGH_AOV,
      'repeat_customer_drop': InsightType.LOW_ENGAGEMENT,
      'unusual_pattern': InsightType.SEASONAL_TREND,
    };
    return mapping[anomalyType] || InsightType.REVENUE_ANOMALY;
  }

  /**
   * Map anomaly severity to insight severity
   */
  private mapAnomalySeverityToInsightSeverity(severity: string): InsightSeverity {
    const mapping: Record<string, InsightSeverity> = {
      'critical': InsightSeverity.CRITICAL,
      'high': InsightSeverity.CRITICAL,
      'medium': InsightSeverity.WARNING,
      'low': InsightSeverity.INFO,
    };
    return mapping[severity] || InsightSeverity.INFO;
  }

  /**
   * Run anomaly detection and alert creation for a tenant's stores
   */
  async runAnomalyDetectionForTenant(tenantId: string): Promise<Map<string, AnomalyScore[]>> {
    this.logger.log(`Running full anomaly detection for tenant ${tenantId}`);

    const resultsMap = new Map<string, AnomalyScore[]>();

    try {
      const anomalies = await this.anomalyDetectionService.detectAnomalies(tenantId);
      resultsMap.set('tenant', anomalies);

      // Trigger alerts
      if (anomalies.length > 0) {
        await this.processAnomalies(tenantId, anomalies);
      }

      return resultsMap;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error running anomaly detection: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Get active alerts for a tenant (unread critical insights)
   */
  async getActiveAlerts(tenantId: string): Promise<any[]> {
    try {
      const criticalInsights = await this.insightService.findCriticalInsights(tenantId);
      return criticalInsights;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching active alerts: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Acknowledge an alert (mark as read)
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await this.insightService.markAsRead(alertId);
      this.logger.log(`Alert ${alertId} acknowledged`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error acknowledging alert: ${message}`);
      throw error as Error;
    }
  }

  /**
   * Action an alert (mark as actioned)
   */
  async actionAlert(alertId: string): Promise<void> {
    try {
      await this.insightService.markAsActioned(alertId);
      this.logger.log(`Alert ${alertId} marked as actioned`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error actioning alert: ${message}`);
      throw error as Error;
    }
  }
}
