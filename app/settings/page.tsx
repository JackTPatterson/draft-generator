"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { AuthGuard } from "@/components/AuthGuard"
import { useSession, signIn } from "@/lib/auth-client"
import { SubscriptionManager } from "@/components/SubscriptionManager"
import { EmailMonitoringDashboard } from "@/components/EmailMonitoringDashboard"
import { GmailEmailMonitorConnection } from "@/components/GmailEmailMonitorConnection"
import {
  SettingsIcon,
  Mail,
  ArrowLeft,
  Zap,
  Shield,
  Bell,
  User,
  LinkIcon,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Loader2,
  CreditCard, ChevronDown,
} from "lucide-react"
import Link from "next/link"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

export default function Settings() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState({
    emailMonitoring: true,
    autoDrafting: true,
    n8nIntegration: false,
    notifications: true,
    n8nWebhookUrl: "",
    n8nApiKey: "",
    aiModel: "gpt-4",
    responseDelay: "30",
  })

  // Email monitoring configuration state
  const [monitorConfig, setMonitorConfig] = useState({
    webhookUrl: "",
    checkInterval: 5,
    maxEmailsPerCheck: 50,
    enableFilters: false,
    filterKeywords: "",
    excludeKeywords: "",
    onlyUnread: true,
    includeSpam: false,
    includeTrash: false,
    webhookSecret: "",
    retryCount: 3,
    retryDelay: 300, // seconds
  })
  
  const [savingConfig, setSavingConfig] = useState(false)

  // Gmail connection now handled by GmailEmailMonitorConnection component

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleMonitorConfigChange = (key: string, value: boolean | string | number) => {
    setMonitorConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveMonitorConfig = async () => {
    try {
      setSavingConfig(true)
      
      // For now, save configuration to localStorage for demonstration
      // In production, this would call the actual API endpoint
      localStorage.setItem('emailMonitorConfig', JSON.stringify(monitorConfig))
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('Monitoring configuration saved successfully:', monitorConfig)
      
      // TODO: Replace with actual API call when backend is ready:
      // const response = await fetch('/api/gmail/email-monitor', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     action: 'update_config',
      //     config: monitorConfig
      //   })
      // })
      
    } catch (error) {
      console.error('Error saving monitoring configuration:', error)
    } finally {
      setSavingConfig(false)
    }
  }

  // Gmail connection functions moved to GmailEmailMonitorConnection component

  return (
      <AuthGuard>
        <div className="min-h-screen">
          {/* Sticky App Bar */}
          <header className="sticky top-0 z-40 backdrop-blur border-b border-gray-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-14 sm:h-16 items-center justify-between">
                <div className="min-w-0 flex items-center gap-3 sm:gap-4">
                  <Link href="/dashboard" className="shrink-0">
                    <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      <span className="hidden xs:inline">Back to Inbox</span>
                      <span className="xs:hidden">Back</span>
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg ">
                      <Mail className="h-5 w-5 text-white" />
                    </div>
                    <span className="truncate text-base sm:text-xl font-bold text-gray-900">
                Fluxyn
              </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Page Header */}
            <div className="mb-6 sm:mb-8">
              <div className="mb-2 flex items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl text-gray-900 font-serif">Settings</h1>
              </div>
              <p className="text-xs sm:text-[14px] text-gray-500">
                Configure your email automation and integration preferences
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-6 lg:gap-8">
              {/* Connected Accounts */}
              <Card className={'border-none shadow-none'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Connected Accounts</span>
                  </CardTitle>
                  <CardDescription>Manage your email account connections</CardDescription>
                </CardHeader>
                <CardContent>
                  <GmailEmailMonitorConnection />

                  {/* Outlook - Coming Soon */}
                  <div className="flex items-center justify-between rounded-xl border-gray-400 border p-4 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                        <Mail className="h-5 w-5 " />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">Outlook</div>
                        <div className="text-sm text-gray-500">Coming soon</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Coming Soon
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Email Monitoring Service */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    <span>Email Monitoring Service</span>
                  </CardTitle>
                  <CardDescription>Configure automated email monitoring for multiple users</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <EmailMonitoringDashboard />
                </CardContent>
              </Card>

              {/* Monitoring Configuration */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Monitoring Configuration</span>
                  </CardTitle>
                  <CardDescription>Configure email monitoring parameters and filters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">


                  {/* Email Filters */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">Email Filters</h4>
                      <Switch
                          checked={monitorConfig.enableFilters}
                          onCheckedChange={(checked) => handleMonitorConfigChange("enableFilters", checked)}
                      />
                    </div>

                    {monitorConfig.enableFilters && (
                        <div className="space-y-4 rounded-lg  p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="min-w-0">
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                Include Keywords
                              </label>
                              <Input
                                  value={monitorConfig.filterKeywords}
                                  onChange={(e) => handleMonitorConfigChange("filterKeywords", e.target.value)}
                                  placeholder="urgent, important, invoice (comma-separated)"
                                  className="text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Only process emails containing these keywords
                              </p>
                            </div>

                            <div className="min-w-0">
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                Exclude Keywords
                              </label>
                              <Input
                                  value={monitorConfig.excludeKeywords}
                                  onChange={(e) => handleMonitorConfigChange("excludeKeywords", e.target.value)}
                                  placeholder="spam, newsletter, unsubscribe (comma-separated)"
                                  className="text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">Skip emails containing these keywords</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2">
                              <Switch
                                  checked={monitorConfig.onlyUnread}
                                  onCheckedChange={(checked) => handleMonitorConfigChange("onlyUnread", checked)}
                              />
                              <span className="text-sm text-gray-700">Only unread emails</span>
                            </label>

                            <label className="flex items-center gap-2">
                              <Switch
                                  checked={monitorConfig.includeSpam}
                                  onCheckedChange={(checked) => handleMonitorConfigChange("includeSpam", checked)}
                              />
                              <span className="text-sm text-gray-700">Include spam folder</span>
                            </label>

                            <label className="flex items-center gap-2">
                              <Switch
                                  checked={monitorConfig.includeTrash}
                                  onCheckedChange={(checked) => handleMonitorConfigChange("includeTrash", checked)}
                              />
                              <span className="text-sm text-gray-700">Include trash folder</span>
                            </label>
                          </div>
                        </div>
                    )}
                  </section>

                  {/* Save Configuration */}
                  <div className="border-t pt-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                      <Button
                          onClick={handleSaveMonitorConfig}
                          disabled={savingConfig || !monitorConfig.webhookUrl}
                          className="min-w-32"
                      >
                        {savingConfig ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                        ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Config
                            </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Automation */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    <span>Email Automation</span>
                  </CardTitle>
                  <CardDescription>Configure automated email processing and responses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">Email Monitoring</div>
                      <div className="text-sm text-gray-500">
                        Automatically watch for new incoming emails
                      </div>
                    </div>
                    <Switch
                        checked={settings.emailMonitoring}
                        onCheckedChange={(checked) => handleSettingChange("emailMonitoring", checked)}
                    />
                  </div>

                  <div className="flex items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">Auto-Draft Replies</div>
                      <div className="text-sm text-gray-500">
                        Generate AI-powered draft responses automatically
                      </div>
                    </div>
                    <Switch
                        checked={settings.autoDrafting}
                        onCheckedChange={(checked) => handleSettingChange("autoDrafting", checked)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={'w-full'}>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Model
                      </label>
                      <Select

                          value={settings.aiModel}
                          onValueChange={(value) => handleSettingChange("aiModel", value)}
                      >
                        <SelectTrigger>
                          Model
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                          <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="claude">Claude 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Response Delay (seconds)
                      </label>
                      <Input
                          type="number"
                          value={settings.responseDelay}
                          onChange={(e) => handleSettingChange("responseDelay", e.target.value)}
                          placeholder="30"
                          className="text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security & Privacy */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Security &amp; Privacy</span>
                  </CardTitle>
                  <CardDescription>Manage your data and privacy settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 " />
                      <span className="font-medium">Data Encryption</span>
                    </div>
                    <p className="text-sm ">
                      All your emails and documents are encrypted at rest and in transit using industry-standard encryption.
                    </p>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Shield className="h-5 w-5 " />
                      <span className="font-medium text-blue-900">OAuth Security</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      We use OAuth 2.0 for secure authentication. We never store your email passwords.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full bg-transparent">
                      Export My Data
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent text-red-600 hover:text-red-700">
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </AuthGuard>
  )
}
