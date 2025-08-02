"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import Link from "next/link"

export default function Settings() {
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

  const [connectedAccounts] = useState([
    {
      provider: "Gmail",
      email: "faris@jocreative.com",
      status: "connected",
      lastSync: "2 minutes ago",
    },
    {
      provider: "Outlook",
      email: "faris@company.com",
      status: "disconnected",
      lastSync: "Never",
    },
  ])

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    // Simulate saving settings
    console.log("Saving settings:", settings)
  }

  const testN8nConnection = async () => {
    // Simulate n8n connection test
    console.log("Testing n8n connection...")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Inbox
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Fluxyn</span>
              </div>
            </div>
            <Button onClick={handleSaveSettings}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-gray-600">Configure your email automation and integration preferences</p>
        </div>

        <div className="space-y-8">
          {/* Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Connected Accounts</span>
              </CardTitle>
              <CardDescription>Manage your email account connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectedAccounts.map((account, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{account.provider}</div>
                      <div className="text-sm text-gray-500">{account.email}</div>
                      <div className="text-xs text-gray-400">Last sync: {account.lastSync}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {account.status === "connected" ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                    <Button variant="outline" size="sm">
                      {account.status === "connected" ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Email Automation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Email Automation</span>
              </CardTitle>
              <CardDescription>Configure automated email processing and responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Email Monitoring</div>
                  <div className="text-sm text-gray-500">Automatically watch for new incoming emails</div>
                </div>
                <Switch
                  checked={settings.emailMonitoring}
                  onCheckedChange={(checked) => handleSettingChange("emailMonitoring", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Auto-Draft Replies</div>
                  <div className="text-sm text-gray-500">Generate AI-powered draft responses automatically</div>
                </div>
                <Switch
                  checked={settings.autoDrafting}
                  onCheckedChange={(checked) => handleSettingChange("autoDrafting", checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">AI Model</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={settings.aiModel}
                    onChange={(e) => handleSettingChange("aiModel", e.target.value)}
                  >
                    <option value="gpt-4">GPT-4 (Recommended)</option>
                    <option value="gpt-3.5">GPT-3.5 Turbo</option>
                    <option value="claude">Claude 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Response Delay (seconds)</label>
                  <Input
                    type="number"
                    value={settings.responseDelay}
                    onChange={(e) => handleSettingChange("responseDelay", e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Email Notifications</div>
                  <div className="text-sm text-gray-500">Get notified about new emails and drafts</div>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={(checked) => handleSettingChange("notifications", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security & Privacy</span>
              </CardTitle>
              <CardDescription>Manage your data and privacy settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Data Encryption</span>
                </div>
                <p className="text-sm text-green-700">
                  All your emails and documents are encrypted at rest and in transit using industry-standard encryption.
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">OAuth Security</span>
                </div>
                <p className="text-sm text-blue-700">
                  We use OAuth 2.0 for secure authentication. We never store your email passwords.
                </p>
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full bg-transparent">
                  Export My Data
                </Button>
                <Button variant="outline" className="w-full text-red-600 hover:text-red-700 bg-transparent">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
