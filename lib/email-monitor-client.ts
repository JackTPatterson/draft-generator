/**
 * Email Monitoring Client
 * Client library for integrating with the email monitoring microservice
 */

export interface EmailMonitoringConfig {
  email: string;
  enabled: boolean;
  check_interval_minutes: number;
  labels_to_monitor?: string[];
  n8n_webhook_url: string;
  filter_criteria?: {
    from_domains?: string[];
    subject_contains?: string[];
    has_attachments?: boolean;
    min_importance?: 'low' | 'normal' | 'high';
  };
  notification_settings?: {
    email_notifications: boolean;
    webhook_notifications: boolean;
    max_notifications_per_hour: number;
  };
}

export interface EmailMonitorStats {
  total_emails_processed: number;
  last_check: string;
  status: 'active' | 'paused' | 'error';
  next_check: string;
  emails_today: number;
  webhook_calls_today: number;
}

export interface JobTriggerResponse {
  message: string;
  job_id?: string;
}

export class EmailMonitorClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = 'http://localhost:3003', apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email Monitor API Error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // Health and Status
  async getHealth() {
    return this.request('/health');
  }

  async getMetrics() {
    return this.request('/metrics');
  }

  async getQueueStats() {
    return this.request('/api/queue/stats');
  }

  // Email Monitoring Management
  async addEmailMonitoring(userId: string, config: EmailMonitoringConfig) {
    return this.request(`/api/users/${userId}/email-monitoring`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updateEmailMonitoring(userId: string, config: Partial<EmailMonitoringConfig>) {
    return this.request(`/api/users/${userId}/email-monitoring`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  async removeEmailMonitoring(userId: string) {
    return this.request(`/api/users/${userId}/email-monitoring`, {
      method: 'DELETE',
    });
  }

  async getEmailMonitoring(userId: string): Promise<EmailMonitoringConfig> {
    return this.request(`/api/users/${userId}/email-monitoring`);
  }

  async getEmailMonitoringStats(userId: string): Promise<EmailMonitorStats> {
    return this.request(`/api/users/${userId}/email-monitoring/stats`);
  }

  // Job Management
  async triggerEmailCheck(userId: string): Promise<JobTriggerResponse> {
    return this.request(`/api/jobs/trigger/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ jobType: 'check_emails' }),
    });
  }

  async pauseEmailMonitoring(userId: string) {
    return this.request(`/api/users/${userId}/email-monitoring/pause`, {
      method: 'POST',
    });
  }

  async resumeEmailMonitoring(userId: string) {
    return this.request(`/api/users/${userId}/email-monitoring/resume`, {
      method: 'POST',
    });
  }

  // OAuth & Authentication
  async getGmailAuthUrl(userId: string): Promise<{ auth_url: string }> {
    return this.request(`/api/users/${userId}/gmail/auth-url`);
  }

  async handleGmailCallback(userId: string, code: string) {
    return this.request(`/api/users/${userId}/gmail/callback`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disconnectGmail(userId: string) {
    return this.request(`/api/users/${userId}/gmail/disconnect`, {
      method: 'DELETE',
    });
  }

  // Bulk operations for admin use
  async getAllActiveMonitors(): Promise<Array<{ user_id: string; config: EmailMonitoringConfig }>> {
    return this.request('/api/admin/monitors/active');
  }

  async pauseAllMonitoring() {
    return this.request('/api/admin/monitors/pause-all', {
      method: 'POST',
    });
  }

  async resumeAllMonitoring() {
    return this.request('/api/admin/monitors/resume-all', {
      method: 'POST',
    });
  }
}

// Factory function for easier instantiation
export function createEmailMonitorClient(
  baseUrl?: string,
  apiKey?: string
): EmailMonitorClient {
  return new EmailMonitorClient(baseUrl, apiKey);
}

// Validation helpers
export function validateEmailMonitoringConfig(config: EmailMonitoringConfig): string[] {
  const errors: string[] = [];

  if (!config.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
    errors.push('Valid email address is required');
  }

  if (config.check_interval_minutes < 1 || config.check_interval_minutes > 1440) {
    errors.push('Check interval must be between 1 and 1440 minutes');
  }

  if (!config.n8n_webhook_url || !config.n8n_webhook_url.startsWith('http')) {
    errors.push('Valid n8n webhook URL is required');
  }

  if (config.notification_settings?.max_notifications_per_hour && 
      config.notification_settings.max_notifications_per_hour < 1) {
    errors.push('Max notifications per hour must be at least 1');
  }

  return errors;
}

export default EmailMonitorClient;