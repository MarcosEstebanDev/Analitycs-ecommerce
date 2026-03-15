import { Controller, Get, Post, Query, Req, BadRequestException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { JobSchedulerService } from '../services/job-scheduler.service';

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobSchedulerService: JobSchedulerService) {}

  /**
   * Get job queue statistics
   */
  @Get('stats')
  async getJobStats() {
    try {
      const stats = await this.jobSchedulerService.getJobStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting job stats: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Manually trigger anomaly detection for a tenant
   */
  @Post('trigger-anomaly-detection')
  async triggerAnomalyDetection(
    @Req() req: Request,
  ) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }

    try {
      const job = await this.jobSchedulerService.triggerAnomalyDetection(tenantId);
      return {
        success: true,
        data: {
          jobId: job.id,
          tenantId,
          message: 'Anomaly detection job created successfully',
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error triggering anomaly detection: ${message}`);
      return { success: false, error: message };
    }
  }
}
