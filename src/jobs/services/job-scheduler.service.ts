import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    @InjectQueue('anomaly-detection') private anomalyQueue: Queue,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.initializeRecurringJobs();
      this.logger.log('✅ Recurring jobs initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize recurring jobs', error);
    }
  }

  /**
   * Initialize recurring anomaly detection jobs
   */
  private async initializeRecurringJobs() {
    // This would typically be called once on startup
    // For now, we just log that the service is ready
    this.logger.log('Job scheduler ready for anomaly detection processing');
  }

  /**
   * Manually trigger anomaly detection for a specific tenant
   */
  async triggerAnomalyDetection(tenantId: string) {
    try {
      const job = await this.anomalyQueue.add(
        'anomaly-detection',
        {
          tenantId,
          triggeredAt: new Date().toISOString(),
          manualTrigger: true,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      this.logger.log(`✅ Anomaly detection job created for tenant ${tenantId}: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`❌ Failed to trigger anomaly detection: ${error}`);
      throw error;
    }
  }

  /**
   * Get job queue statistics
   */
  async getJobStats() {
    try {
      const jobCounts = await this.anomalyQueue.getJobCounts();

      return {
        queue: 'anomaly-detection',
        active: jobCounts.active,
        waiting: jobCounts.waiting,
        delayed: jobCounts.delayed,
        failed: jobCounts.failed,
        completed: jobCounts.completed,
        paused: jobCounts.paused,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get job stats: ${error}`);
      throw error;
    }
  }

  /**
   * Clear all failed jobs
   */
  async clearFailedJobs() {
    try {
      await this.anomalyQueue.clean(0, 1000, 'failed');
      this.logger.log('✅ Cleared failed jobs');
    } catch (error) {
      this.logger.error(`❌ Failed to clear jobs: ${error}`);
      throw error;
    }
  }

  /**
   * Pause the queue
   */
  async pauseQueue() {
    try {
      await this.anomalyQueue.pause();
      this.logger.log('✅ Queue paused');
    } catch (error) {
      this.logger.error(`❌ Failed to pause queue: ${error}`);
      throw error;
    }
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    try {
      await this.anomalyQueue.resume();
      this.logger.log('✅ Queue resumed');
    } catch (error) {
      this.logger.error(`❌ Failed to resume queue: ${error}`);
      throw error;
    }
  }
}
