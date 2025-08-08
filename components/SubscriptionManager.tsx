'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/lib/auth-client"
import { authClient } from "@/lib/auth-client"
import { useState, useEffect } from "react"
import { Loader2, CreditCard, Calendar, AlertCircle, CheckCircle } from "lucide-react"

interface Subscription {
  id: string
  status: string
  planName: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
}

export function SubscriptionManager() {
  const { data: session } = useSession()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [session])

  const loadSubscription = async () => {
    if (!session?.user?.id) return
    
    try {
      setLoading(true)
      const subs = await authClient.subscription.list()
      if (subs && subs.length > 0) {
        setSubscription(subs[0])
      }
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planName: string) => {
    try {
      setActionLoading(true)
      await authClient.subscription.upgrade({
        plan: planName,
        successUrl: window.location.origin + "/settings",
        cancelUrl: window.location.origin + "/settings",
      })
    } catch (error) {
      console.error('Upgrade failed:', error)
      alert('Failed to upgrade subscription. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!subscription?.id) return
    
    const confirmed = confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.')
    if (!confirmed) return

    try {
      setActionLoading(true)
      await authClient.subscription.cancel({
        subscriptionId: subscription.id
      })
      await loadSubscription()
      alert('Subscription cancelled successfully. You will retain access until the end of your billing period.')
    } catch (error) {
      console.error('Cancellation failed:', error)
      alert('Failed to cancel subscription. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!subscription?.id) return

    try {
      setActionLoading(true)
      await authClient.subscription.restore({
        subscriptionId: subscription.id
      })
      await loadSubscription()
      alert('Subscription restored successfully!')
    } catch (error) {
      console.error('Restore failed:', error)
      alert('Failed to restore subscription. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="destructive">Cancelling</Badge>
    }
    
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'trialing':
        return <Badge variant="secondary">Free Trial</Badge>
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>
      case 'canceled':
        return <Badge variant="outline">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            No Active Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-500">
            You don't have an active subscription. Choose a plan to get started.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => handleUpgrade('basic')}
              disabled={actionLoading}
              variant="outline"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Basic Plan ($19/mo)
            </Button>
            <Button
              onClick={() => handleUpgrade('pro')}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pro Plan ($49/mo)
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </span>
            {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-semibold capitalize">{subscription.planName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-semibold capitalize">{subscription.status}</p>
            </div>
            {subscription.trialEnd && (
              <div>
                <p className="text-sm text-gray-500">Trial Ends</p>
                <p className="font-semibold">{formatDate(subscription.trialEnd)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">
                {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing'}
              </p>
              <p className="font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Your subscription is set to cancel at the end of the current billing period.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {subscription.planName === 'basic' && !subscription.cancelAtPeriodEnd && (
              <Button
                onClick={() => handleUpgrade('pro')}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upgrade to Pro
              </Button>
            )}
            
            {subscription.cancelAtPeriodEnd ? (
              <Button
                onClick={handleRestore}
                disabled={actionLoading}
                variant="default"
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Restore Subscription
              </Button>
            ) : (
              <Button
                onClick={handleCancel}
                disabled={actionLoading}
                variant="destructive"
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}