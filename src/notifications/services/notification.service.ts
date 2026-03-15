import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { NotificationPayload, NotificationResult, EmailNotificationPayload, WebhookNotificationPayload, SlackNotificationPayload } from '../interfaces/notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly webhookTimeout = 5000; // 5 seconds

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send notification via specified channel
   */
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.log(`Sending ${payload.type} notification to ${payload.recipient}`);

    try {
      switch (payload.type) {
        case 'webhook':
          return await this.sendWebhookNotification(payload as WebhookNotificationPayload);
        case 'slack':
          return await this.sendSlackNotification(payload as SlackNotificationPayload);
        case 'email':
          return await this.sendEmailNotification(payload as EmailNotificationPayload);
        default:
          return {
            success: false,
            type: payload.type,
            recipient: payload.recipient,
            sentAt: new Date(),
            error: 'Unsupported notification type',
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending notification: ${message}`);
      return {
        success: false,
        type: payload.type,
        recipient: payload.recipient,
        sentAt: new Date(),
        error: message,
      };
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    payload: WebhookNotificationPayload,
  ): Promise<NotificationResult> {
    return new Promise((resolve) => {
      const url = new URL(payload.recipient);
      const data = JSON.stringify({
        message: payload.message,
        subject: payload.subject,
        data: payload.data,
        priority: payload.priority,
        timestamp: new Date(),
      });

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...payload.headers,
        },
        timeout: this.webhookTimeout,
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          const statusCode = res.statusCode ?? 500;
          const success = statusCode >= 200 && statusCode < 300;
          resolve({
            success,
            type: 'webhook',
            recipient: payload.recipient,
            sentAt: new Date(),
            error: success ? undefined : `HTTP ${statusCode}`,
          });
        });
      });

      req.on('error', (err) => {
        this.logger.error(`Webhook error: ${err.message}`);
        resolve({
          success: false,
          type: 'webhook',
          recipient: payload.recipient,
          sentAt: new Date(),
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          type: 'webhook',
          recipient: payload.recipient,
          sentAt: new Date(),
          error: 'Request timeout',
        });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    payload: SlackNotificationPayload,
  ): Promise<NotificationResult> {
    const slackWebhook = this.configService.get('SLACK_WEBHOOK_URL');
    if (!slackWebhook) {
      this.logger.warn('SLACK_WEBHOOK_URL not configured');
      return {
        success: false,
        type: 'slack',
        recipient: payload.recipient,
        sentAt: new Date(),
        error: 'Slack webhook not configured',
      };
    }

    const color = this.mapPriorityToSlackColor(payload.priority || 'medium');
    const slackMessage = {
      attachments: [
        {
          color,
          title: payload.subject || 'Alert',
          text: payload.message,
          fields: [
            {
              title: 'Priority',
              value: payload.priority || 'medium',
              short: true,
            },
            {
              title: 'Timestamp',
              value: new Date().toISOString(),
              short: true,
            },
          ],
          mrkdwn_in: ['text'],
        },
      ],
    };

    return new Promise((resolve) => {
      const url = new URL(slackWebhook);
      const data = JSON.stringify(slackMessage);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: this.webhookTimeout,
      };

      const req = https.request(options, (res) => {
        const statusCode = res.statusCode ?? 500;
        const success = statusCode >= 200 && statusCode < 300;
        resolve({
          success,
          type: 'slack',
          recipient: payload.recipient,
          sentAt: new Date(),
          error: success ? undefined : `HTTP ${statusCode}`,
        });
      });

      req.on('error', (err) => {
        this.logger.error(`Slack error: ${err.message}`);
        resolve({
          success: false,
          type: 'slack',
          recipient: payload.recipient,
          sentAt: new Date(),
          error: err.message,
        });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Send email notification
   * Placeholder - integrate with SendGrid, Mailgun, or SMTP
   */
  private async sendEmailNotification(
    payload: EmailNotificationPayload,
  ): Promise<NotificationResult> {
    // TODO: Implement email sending via SendGrid, Mailgun, or SMTP
    // For now, return a simulated success
    this.logger.log(`Email notification queued for ${payload.recipient}`);

    return {
      success: true,
      type: 'email',
      recipient: payload.recipient,
      sentAt: new Date(),
    };
  }

  /**
   * Map priority to Slack color
   */
  private mapPriorityToSlackColor(priority: string): string {
    const colorMap: Record<string, string> = {
      'critical': 'danger',
      'high': 'danger',
      'medium': 'warning',
      'low': 'good',
    };
    return colorMap[priority] || 'warning';
  }

  /**
   * Send multiple notifications
   */
  async sendNotifications(payloads: NotificationPayload[]): Promise<NotificationResult[]> {
    const results = await Promise.all(
      payloads.map((payload) => this.sendNotification(payload)),
    );
    return results;
  }

  /**
   * Send alert via multiple channels
   */
  async sendAlert(
    subject: string,
    message: string,
    data?: Record<string, unknown>,
    channels?: string[],
  ): Promise<NotificationResult[]> {
    const defaultChannels = channels || ['webhook'];
    const payloads: NotificationPayload[] = [];

    for (const channel of defaultChannels) {
      if (channel === 'webhook') {
        const webhookUrl = this.configService.get('ALERT_WEBHOOK_URL');
        if (webhookUrl) {
          payloads.push({
            type: 'webhook',
            recipient: webhookUrl,
            subject,
            message,
            data,
            priority: 'high',
          });
        }
      } else if (channel === 'slack') {
        payloads.push({
          type: 'slack',
          recipient: 'default',
          subject,
          message,
          data,
          priority: 'high',
        });
      }
    }

    return this.sendNotifications(payloads);
  }
}
