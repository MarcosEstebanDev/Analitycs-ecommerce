import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlertService } from '../../analytics/services/alert.service';
import { TenantService } from '../../database/services';

export interface AnomalyDetectionJobData {
  tenantId: string;
  jobId?: string;
}

@Processor('anomaly-detection')
@Injectable()
export class AnomalyDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(AnomalyDetectionProcessor.name);

  constructor(
    private readonly alertService: AlertService,
    private readonly tenantService: TenantService,
  ) {
    super();
  }

  /**
   * Process anomaly detection job
   */
  async process(job: Job<AnomalyDetectionJobData>) {
    const { tenantId } = job.data;
    this.logger.log(`[Job ${job.id}] Starting anomaly detection for tenant ${tenantId}`);

    try {
      // Verify tenant exists
      const tenant = await this.tenantService.findById(tenantId);
      if (!tenant) {
        this.logger.warn(`[Job ${job.id}] Tenant ${tenantId} not found`);
        return { success: false, error: 'Tenant not found' };
      }

      // Run anomaly detection
      const results = await this.alertService.runAnomalyDetectionForTenant(tenantId);

      this.logger.log(
        `[Job ${job.id}] Anomaly detection completed for tenant ${tenantId}. Found ${results.get('tenant')?.length} anomalies`,
      );

      return {
        success: true,
        tenantId,
        anomalyCount: results.get('tenant')?.length || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Job ${job.id}] Error in anomaly detection: ${message}`);
      throw error; // Retry the job
    }
  }

  /**
   * Called when job completes successfully
   */
  onCompleted(job: Job<AnomalyDetectionJobData>) {
    this.logger.log(`[Job ${job.id}] Anomaly detection job completed successfully`);
  }

  /**
   * Called when job fails
   */
  onFailed(job: Job<AnomalyDetectionJobData>, err: Error) {
    this.logger.error(
      `[Job ${job.id}] Anomaly detection job failed: ${err.message}`,
      err.stack,
    );
  }
}
