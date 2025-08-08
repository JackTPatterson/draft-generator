"use client"

import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {Input} from "@/components/ui/input"
import {Switch} from "@/components/ui/switch"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Mail,
  PlugZap, Power,
  Save,
  Settings,
  Zap,
} from "lucide-react"
import {useSession} from "@/lib/auth-client";
import { EmailProcessingChart } from "./EmailProcessingChart";
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface GmailMonitorStatus {
  connected: boolean
  gmail_connected: boolean
  monitoring_enabled: boolean
  last_checked: string | null
  status: string
  emails_today: number
  total_emails: number
  next_check: string | null
  has_access_token?: boolean
  token_expires_at?: string | null
  monitoring_configured?: boolean
}

export function GmailEmailMonitorConnection() {

  const { data: session } = useSession()

  const [status, setStatus] = useState<GmailMonitorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [checkInterval, setCheckInterval] = useState(5)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if(session){
      fetchStatus()
    }
  }, [session])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/gmail/email-monitor`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json()
        // Map gmail_connected to connected for UI compatibility
        const mappedData = {
          ...data,
          connected: data.gmail_connected || false,
          monitoring_enabled: data.monitoring_enabled || false,
          emails_today: data.emails_today || 0,
          total_emails: data.total_emails || 0,
          status: data.monitoring_enabled ? 'active' : 'inactive'
        }
        setStatus(mappedData)
        
        // Initialize webhook URL from fetched status if available
        if (data.n8n_webhook_url && webhookUrl === "") {
          setWebhookUrl(data.n8n_webhook_url)
        }
        if (data.check_interval_minutes) {
          setCheckInterval(data.check_interval_minutes)
        }
      } else {
        console.error('Failed to fetch Gmail status')
        setStatus(null)
      }
    } catch (error) {
      console.error('Error fetching Gmail status:', error)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const userEmail = session?.user?.email

      if (!session?.user?.id || !userEmail) {
        console.error('No user ID or email found in session')
        setConnecting(false)
        return
      }

      // Now try to get the OAuth URL
      const oauthResponse = await fetch('/api/gmail/email-monitor', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'connect'
        })
      })

      const body = await oauthResponse.json()

      if(oauthResponse.status === 404){
        if(body.error === 'User not found'){
          const myHeaders = new Headers();
          myHeaders.append("Content-Type", "application/json");
          myHeaders.append("Accept", "application/json");

          const raw = JSON.stringify({
            "email": session.user.email,
            "name": session.user.name,
            "custom_id": session.user.id
          });

          const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
          };

          fetch("http://localhost:8080/api/users", requestOptions)
              .then((response) => response.text())
              .then((result) => console.log(result))
              .catch((error) => console.error(error));
        }
      }
      
      if (oauthResponse.ok) {
        // Open OAuth URL in new window
        window.open(body.auth_url, 'gmail-oauth', 'width=600,height=600,scrollbars=yes,resizable=yes')
        
        // Poll for connection status
        // const pollInterval = setInterval(async () => {
          await fetchStatus()
          // if (status?.connected) {
          //   clearInterval(pollInterval)
          //   setConnecting(false)
          // }
        // }, 3001)
        
        // Stop polling after 5 minutes
        // setTimeout(() => {
        //   clearInterval(pollInterval)
        //   setConnecting(false)
        // }, 300000)
      } else {
        const errorData = body
        console.error('Failed to get OAuth URL:', errorData.error)
        setConnecting(false)
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error)
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? This will stop email monitoring.')) {
      return
    }

    try {
      setDisconnecting(true)
      const response = await fetch('/api/gmail/email-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      if (response.ok) {
        await fetchStatus()
      } else {
        const errorData = await response.json()
        console.error('Failed to disconnect Gmail:', errorData.error)
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleToggleMonitoring = async () => {
    try {
      setToggling(true)
      const action = status?.monitoring_enabled ? 'disable_monitoring' : 'enable_monitoring'
      
      const body: any = { action }
      if (action === 'enable_monitoring') {
        if (!webhookUrl) {
          console.error('Webhook URL is required to enable monitoring')
          alert('Please enter a webhook URL in the configuration section before enabling monitoring.')
          setShowAdvanced(true)
          return
        }
        body.webhook_url = webhookUrl
        body.check_interval = checkInterval
      }
      
      console.log('Toggling monitoring:', action, body)
      
      const response = await fetch('/api/gmail/email-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Monitoring toggle result:', result)
        await fetchStatus()
      } else {
        const errorData = await response.json()
        console.error('Failed to toggle monitoring:', errorData)
        alert(`Failed to ${action.replace('_', ' ')}: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error)
      alert(`Error toggling monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setToggling(false)
    }
  }

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/gmail/email-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update',
          webhook_url: webhookUrl,
          check_interval: checkInterval
        })
      })

      const responseData = await response.json()

      if (response.ok) {
        setHasUnsavedChanges(false)
        await fetchStatus()
      } else {
        console.error('Failed to save configuration:', responseData)
        alert(`Failed to save configuration: ${responseData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      alert(`Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleWebhookUrlChange = (value: string) => {
    setWebhookUrl(value)
    setHasUnsavedChanges(true)
  }

  const handleCheckIntervalChange = (value: number) => {
    setCheckInterval(value)
    setHasUnsavedChanges(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Mail className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Gmail (Email Monitoring)</div>
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main Gmail Connection Card */}
      <div className="flex items-center justify-between p-4 border rounded-xl border-gray-300">
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 p-1 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  <img src={'https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-02-512.png'}/>
                </span>
            </div>
            <div>
              <span className="text-sm font-medium">Gmail</span>
              <div>
                {status?.connected ? (
                    <>
                      <div className="text-sm text-gray-500">
                        {status.monitoring_enabled ? 'Monitoring active' : 'Monitoring inactive'}
                      </div>
                    </>
                ) : (
                    <div className="text-sm text-gray-500">Not connected to monitoring service</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {status?.connected ? (
            <>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Gmail Connected
              </Badge>
            </>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="w-3 h-3 mr-1" />
              Not Connected
            </Badge>
          )}

          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlugZap className="mr-2 h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuLabel>Gmail Connection</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {!status?.connected ? (
                    <DropdownMenuItem
                        onClick={handleConnect}
                        disabled={connecting}
                    >
                      {connecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                      ) : (
                          <>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Connect Gmail
                          </>
                      )}
                    </DropdownMenuItem>
                ) : (
                    <>
                      <DropdownMenuItem
                          onClick={() => handleToggleMonitoring()}
                          disabled={toggling}
                          className={
                            status?.monitoring_enabled
                                ? " focus:text-blue-700"
                                : ""
                          }
                      >
                        {toggling ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {status?.monitoring_enabled
                                  ? "Disabling..."
                                  : "Enabling..."}
                            </>
                        ) : (
                            <>
                              <Zap className="mr-2 h-4 w-4" />
                              {status?.monitoring_enabled
                                  ? "Disable Monitoring"
                                  : "Enable Monitoring"}
                            </>
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                          onClick={() => setShowAdvanced(!showAdvanced)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        {showAdvanced ? "Hide Config" : "Configure"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          className="text-red-600 focus:text-red-700"
                      >
                        {disconnecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Disconnecting...
                            </>
                        ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              Disconnect
                            </>
                        )}
                      </DropdownMenuItem>
                    </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {status?.connected && (
        <div className="grid grid-cols-3 gap-4 px-4">
          <div className="text-center p-3  rounded-lg">
            <div className="text-xl font-bold ">{status.emails_today || 0}</div>
            <div className="text-xs text-gray-500">Emails Today</div>
          </div>
          <div className="text-center p-3  rounded-lg">
            <div className="text-xl font-bold ">{status.total_emails || 0}</div>
            <div className="text-xs text-gray-500">Total Processed</div>
          </div>
          <div className="text-center p-3  rounded-lg">
            <div className={`text-xl font-bold ${status.monitoring_enabled ? '' : 'text-gray-400'}`}>
              {status.monitoring_enabled ? 'ON' : 'OFF'}
            </div>
            <div className="text-xs text-gray-500">Monitoring Status</div>
          </div>
        </div>
      )}

      {/* Configuration */}
      {showAdvanced && status?.connected && (
        <div className="p-4 border rounded-lg  space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Configuration</div>
              <div className="text-sm text-gray-500">
                Configure your webhook URL and check interval settings
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              N8N Webhook URL
            </label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(e) => handleWebhookUrlChange(e.target.value)}
              placeholder="https://your-n8n-instance.com/webhook/your-webhook-id"
              className="text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              New emails will be sent to this webhook URL for processing
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Check Interval (minutes)
            </label>
            <Input
              type="number"
              value={checkInterval}
              onChange={(e) => handleCheckIntervalChange(parseInt(e.target.value) || 5)}
              min={1}
              max={60}
              className="text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">
              How often to check for new emails (1-60 minutes)
            </div>
          </div>

          {hasUnsavedChanges && (
            <div className="flex space-x-2">
              <Button 
                onClick={handleSaveConfiguration}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Email Processing Analytics */}
      {status?.connected && status?.monitoring_enabled && (
        <div className="mt-6">
          <EmailProcessingChart />
        </div>
      )}
    </div>
  )
}