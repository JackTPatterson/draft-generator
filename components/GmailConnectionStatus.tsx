"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, RefreshCw, Mail, AlertTriangle } from "lucide-react"

interface GmailStatus {
  connected: boolean
  synced: boolean
  needsSync: boolean
  expires_at: string | null
  last_updated: string | null
  connected_at: string | null
}

export function GmailConnectionStatus() {
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gmail/connection')
      const data = await response.json()
      
      if (data.success) {
        setStatus(data)
        setError("")
      } else {
        setError(data.error || 'Failed to fetch Gmail status')
      }
    } catch (err) {
      setError('Failed to fetch Gmail connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/gmail/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchStatus() // Refresh status
      } else {
        setError(data.error || 'Failed to sync Gmail tokens')
      }
    } catch (err) {
      setError('Failed to sync Gmail tokens')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-500">Checking Gmail connection...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchStatus} className="mt-4" variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Connection
        </CardTitle>
        <CardDescription>
          Manage your Gmail account connection for email automation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Connected
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <Badge variant="outline" className="text-red-700 border-red-300">
                  Not Connected
                </Badge>
              </>
            )}
          </div>
        </div>

        {status.connected && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gmail API Access:</span>
              <div className="flex items-center gap-2">
                {status.synced ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Active
                    </Badge>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                      Needs Sync
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {status.connected_at && (
              <div className="text-xs text-gray-500">
                Connected: {new Date(status.connected_at).toLocaleString()}
              </div>
            )}

            {status.expires_at && (
              <div className="text-xs text-gray-500">
                Token expires: {new Date(status.expires_at).toLocaleString()}
              </div>
            )}

            {status.needsSync && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your Gmail tokens need to be synced for email automation to work properly.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <div className="flex gap-2">
          {!status.connected ? (
            <Button 
              onClick={() => {
                // Get OAuth URL from microservice and open it
                fetch('/api/gmail/email-monitor', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'connect' })
                })
                .then(res => res.json())
                .then(data => {
                  if (data.auth_url) {
                    window.open(data.auth_url, '_blank');
                  } else {
                    console.error('No auth URL received:', data);
                  }
                })
                .catch(err => console.error('Error getting OAuth URL:', err));
              }}
              className="w-full"
            >
              Connect Gmail Account
            </Button>
          ) : status.needsSync ? (
            <Button onClick={handleSync} disabled={syncing} className="w-full">
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Gmail Access
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button onClick={fetchStatus} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleSync} variant="outline" size="sm" disabled={syncing}>
                {syncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Re-sync
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}