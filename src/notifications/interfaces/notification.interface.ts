/**
 * Notification interfaces and types
 */

export interface NotificationPayload {
  type: NotificationType;
  recipient: string;
  subject?: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface EmailNotificationPayload extends NotificationPayload {
  type: 'email';
  recipient: string; // email address
  htmlContent?: string;
  template?: string;
}

export interface WebhookNotificationPayload extends NotificationPayload {
  type: 'webhook';
  recipient: string; // webhook URL
  headers?: Record<string, string>;
}

export interface SlackNotificationPayload extends NotificationPayload {
  type: 'slack';
  recipient: string; // slack webhook or channel
  color?: 'good' | 'warning' | 'danger';
}

export interface NotificationResult {
  success: boolean;
  type: NotificationType;
  recipient: string;
  sentAt: Date;
  error?: string;
}

export type NotificationType = 'email' | 'webhook' | 'sms' | 'slack' | 'push';

export interface NotificationConfig {
  emailProvider?: 'smtp' | 'sendgrid' | 'mailgun';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  slackWebhookUrl?: string;
  webhookTimeout?: number;
}
