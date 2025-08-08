'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Mail, 
  Settings, 
  TrendingUp,
  Webhook,
  RefreshCw,
  Pause,
  Play,
  TestTube,
  RotateCcw,
  BarChart3
} from 'lucide-react';

interface MonitoringConfig {
  monitoring_enabled: boolean;
  monitoring_status: 'active' | 'paused' | 'error' | 'disabled';
  check_interval_minutes: number;
  max_emails_per_check: number;
  gmail_last_checked?: string;
  consecutive_errors: number;
  last_error_message?: string;
  n8n_webhook_url?: string;
  gmail_connected: boolean;
  pending_jobs: number;
  stats: {
    emails_today: number;
    errors_today: number;
    webhook_calls_today: number;
  };
}

interface MonitoringStats {
  summary: {
    emails_checked: number;
    emails_processed: number;
    emails_failed: number;
    success_rate: number;
    webhook_calls: number;
    webhook_success_rate: number;
    avg_processing_time_ms: number;
  };
  current_status: {
    monitoring_status: string;
    last_checked?: string;
    consecutive_errors: number;
    pending_jobs: number;
  };
  daily_breakdown: Array<{
    date: string;
    emails_processed: number;
    success_rate: number;
    webhook_calls: number;
  }>;
}

export function EmailMonitoringDashboard() {
  const [config, setConfig] = useState<MonitoringConfig | null>(null);
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    check_interval_minutes: 5,
    max_emails_per_check: 50,
    n8n_webhook_url: '',
    n8n_webhook_secret: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/email-monitoring'),
        fetch('/api/email-monitoring/stats?period=7d')
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        setFormData({
          check_interval_minutes: configData.check_interval_minutes || 5,
          max_emails_per_check: configData.max_emails_per_check || 50,
          n8n_webhook_url: configData.n8n_webhook_url === '[CONFIGURED]' ? '' : configData.n8n_webhook_url || '',
          n8n_webhook_secret: ''
        });
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableMonitoring = async () => {
    if (!formData.n8n_webhook_url) {
      alert('Please enter a webhook URL');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          ...formData
        })
      });

      if (response.ok) {
        await loadData();
        alert('Email monitoring enabled successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to enable monitoring: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to enable monitoring');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableMonitoring = async () => {
    if (!confirm('Are you sure you want to disable email monitoring?')) return;

    setSaving(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' })
      });

      if (response.ok) {
        await loadData();
        alert('Email monitoring disabled');
      }
    } catch (error) {
      alert('Failed to disable monitoring');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          ...formData
        })
      });

      if (response.ok) {
        await loadData();
        alert('Configuration updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update configuration: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!formData.n8n_webhook_url) {
      alert('Please enter a webhook URL');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_webhook',
          webhook_url: formData.n8n_webhook_url
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('Webhook test successful!');
      } else {
        alert(`Webhook test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Webhook test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleResetErrors = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_errors' })
      });

      if (response.ok) {
        await loadData();
        alert('Error count reset successfully!');
      }
    } catch (error) {
      alert('Failed to reset errors');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading monitoring data...
      </div>
    );
  }

  if (!config?.gmail_connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-500">
              Please connect your Gmail account first to enable email monitoring.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(config.monitoring_status)}>
              {getStatusIcon(config.monitoring_status)}
              <span className="ml-1 capitalize">{config.monitoring_status}</span>
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Emails Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{config.stats?.emails_today}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{config.pending_jobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.summary.success_rate || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="interval">Check Interval (minutes)</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="60"
                value={formData.check_interval_minutes}
                onChange={(e) => setFormData({ ...formData, check_interval_minutes: parseInt(e.target.value) || 5 })}
              />
            </div>
            <div>
              <Label htmlFor="maxEmails">Max Emails Per Check</Label>
              <Input
                id="maxEmails"
                type="number"
                min="1"
                max="100"
                value={formData.max_emails_per_check}
                onChange={(e) => setFormData({ ...formData, max_emails_per_check: parseInt(e.target.value) || 50 })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="webhookUrl">n8n Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                placeholder="https://your-n8n-instance.com/webhook/..."
                value={formData.n8n_webhook_url}
                onChange={(e) => setFormData({ ...formData, n8n_webhook_url: e.target.value })}
              />
              <Button 
                variant="outline" 
                onClick={handleTestWebhook}
                disabled={testing || !formData.n8n_webhook_url}
              >
                {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Test
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
            <Input
              id="webhookSecret"
              type="password"
              placeholder="Optional secret for webhook authentication"
              value={formData.n8n_webhook_secret}
              onChange={(e) => setFormData({ ...formData, n8n_webhook_secret: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            {!config.monitoring_enabled || config.monitoring_status === 'disabled' ? (
              <Button onClick={handleEnableMonitoring} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Enable Monitoring
              </Button>
            ) : (
              <>
                <Button onClick={handleUpdateConfig} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Update Config
                </Button>
                <Button variant="outline" onClick={handleDisableMonitoring} disabled={saving}>
                  <Pause className="h-4 w-4 mr-2" />
                  Disable
                </Button>
              </>
            )}
            
            {config.consecutive_errors > 0 && (
              <Button variant="outline" onClick={handleResetErrors} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Errors
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Error Information */}
      {config.consecutive_errors > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Error Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Consecutive Errors:</strong> {config.consecutive_errors}</p>
              {config.last_error_message && (
                <p><strong>Last Error:</strong> {config.last_error_message}</p>
              )}
              <p className="text-sm text-gray-500">
                If you continue to see errors, please check your Gmail permissions and n8n webhook configuration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}