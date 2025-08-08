'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Webhook,
  Play,
  Pause,
  Settings,
  BarChart3, Settings2, Loader2, RefreshCw, RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface EmailMonitoringConfig {
  monitoring_enabled: boolean;
  monitoring_status: 'active' | 'paused' | 'error' | 'disabled';
  check_interval_minutes: number;
  max_emails_per_check: number;
  n8n_webhook_url?: string;
  gmail_connected: boolean;
  pending_jobs: number;
  consecutive_errors: number;
  last_error_message?: string;
  gmail_last_checked?: string;
  stats: {
    emails_today: number;
    errors_today: number;
    webhook_calls_today: number;
  };
}

export default function EmailMonitoringManager() {
  const [config, setConfig] = useState<EmailMonitoringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [checkInterval, setCheckInterval] = useState(5);
  const [maxEmails, setMaxEmails] = useState(50);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/email-monitoring');
      const data = await response.json();
      
      if (response.ok) {
        setConfig(data);
        if (data.monitoring_enabled) {
          setCheckInterval(data.check_interval_minutes);
          setMaxEmails(data.max_emails_per_check);
          setWebhookUrl(data.n8n_webhook_url === '[CONFIGURED]' ? '' : data.n8n_webhook_url || '');
        }
      } else {
        setError(data.error || 'Failed to load configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const enableMonitoring = async () => {
    if (!webhookUrl.trim()) {
      setError('Webhook URL is required');
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          n8n_webhook_url: webhookUrl,
          check_interval_minutes: checkInterval,
          max_emails_per_check: maxEmails,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        await fetchConfig();
      } else {
        setError(data.error || 'Failed to enable monitoring');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setUpdating(false);
    }
  };

  const disableMonitoring = async () => {
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        await fetchConfig();
      } else {
        setError(data.error || 'Failed to disable monitoring');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setUpdating(false);
    }
  };

  const updateConfiguration = async () => {
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          check_interval_minutes: checkInterval,
          max_emails_per_check: maxEmails,
          ...(webhookUrl && { n8n_webhook_url: webhookUrl }),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        await fetchConfig();
      } else {
        setError(data.error || 'Failed to update configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setUpdating(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl.trim()) {
      setError('Webhook URL is required');
      return;
    }

    setTestingWebhook(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_webhook',
          webhook_url: webhookUrl,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`Webhook test successful (Status: ${data.status_code})`);
      } else {
        setError(`Webhook test failed: ${data.error || data.message}`);
      }
    } catch (err) {
      setError('Failed to test webhook');
    } finally {
      setTestingWebhook(false);
    }
  };

  const resetErrors = async () => {
    setUpdating(true);
    try {
      const response = await fetch('/api/email-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_errors' }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        await fetchConfig();
      } else {
        setError(data.error || 'Failed to reset errors');
      }
    } catch (err) {
      setError('Failed to reset errors');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, icon: <CheckCircle className="w-4 h-4" />, text: "Active" },
      paused: { variant: "secondary" as const, icon: <Pause className="w-4 h-4" />, text: "Paused" },
      error: { variant: "destructive" as const, icon: <AlertCircle className="w-4 h-4" />, text: "Error" },
      disabled: { variant: "outline" as const, icon: <Clock className="w-4 h-4" />, text: "Disabled" },
    };

    const statusInfo = variants[status as keyof typeof variants] || variants.disabled;
    
    return (
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        {statusInfo.icon}
        {statusInfo.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-r-transparent" />
            Loading email monitoring configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Email Monitoring Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!config?.gmail_connected ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Gmail must be connected before enabling email monitoring. 
                Please connect your Gmail account in settings first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                {config?.monitoring_enabled 
                  ? getStatusBadge(config.monitoring_status)
                  : <Badge variant="outline">Disabled</Badge>
                }
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">Today: {config?.stats.emails_today || 0} emails</span>
              </div>
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4" />
                <span className="text-sm">Webhooks: {config?.stats.webhook_calls_today || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Pending: {config?.pending_jobs || 0} jobs</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Configuration Tabs */}
      {config?.gmail_connected && (
        <Tabs defaultValue="setup">
          <TabsList>
            <TabsTrigger value="setup">
              <Settings className="w-4 h-4 mr-2" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle>Email Monitoring Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="webhookUrl">n8n Webhook URL *</Label>
                    <Input
                      id="webhookUrl"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-n8n.com/webhook/your-webhook-id"
                      disabled={updating}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={testWebhook}
                      disabled={testingWebhook || !webhookUrl}
                      variant="outline"
                      size="sm"
                    >
                      {testingWebhook ? 'Testing...' : 'Test Webhook'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkInterval">Check Interval (minutes)</Label>
                    <Input
                      id="checkInterval"
                      type="number"
                      min="1"
                      max="1440"
                      value={checkInterval}
                      onChange={(e) => setCheckInterval(parseInt(e.target.value) || 5)}
                      disabled={updating}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxEmails">Max Emails per Check</Label>
                    <Input
                      id="maxEmails"
                      type="number"
                      min="1"
                      max="500"
                      value={maxEmails}
                      onChange={(e) => setMaxEmails(parseInt(e.target.value) || 50)}
                      disabled={updating}
                    />
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Monitor Actions
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                    <DropdownMenuLabel>Monitoring</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {!config?.monitoring_enabled ? (
                        <DropdownMenuItem
                            onClick={enableMonitoring}
                            disabled={updating || !webhookUrl}
                        >
                          {updating ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              <Play className="mr-2 h-4 w-4" />
                          )}
                          {updating ? "Enabling..." : "Enable Monitoring"}
                        </DropdownMenuItem>
                    ) : (
                        <>
                          <DropdownMenuItem
                              onClick={disableMonitoring}
                              disabled={updating}
                              className="text-red-600 focus:text-red-700"
                          >
                            {updating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Pause className="mr-2 h-4 w-4" />
                            )}
                            {updating ? "Disabling..." : "Disable Monitoring"}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                              onClick={updateConfiguration}
                              disabled={updating}
                          >
                            {updating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {updating ? "Updating..." : "Update Configuration"}
                          </DropdownMenuItem>

                          {config?.consecutive_errors > 0 && (
                              <DropdownMenuItem
                                  onClick={resetErrors}
                                  disabled={updating}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset Errors
                              </DropdownMenuItem>
                          )}
                        </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{config?.stats.emails_today || 0}</div>
                    <div className="text-sm text-muted-foreground">Emails processed today</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{config?.stats.webhook_calls_today || 0}</div>
                    <div className="text-sm text-muted-foreground">Webhook calls today</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{config?.stats.errors_today || 0}</div>
                    <div className="text-sm text-muted-foreground">Errors today</div>
                  </div>
                </div>

                {config?.last_error_message && config.consecutive_errors > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Recent Error ({config.consecutive_errors} consecutive):</strong>
                      <br />
                      {config.last_error_message}
                    </AlertDescription>
                  </Alert>
                )}

                {config?.gmail_last_checked && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Last checked: {new Date(config.gmail_last_checked).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}