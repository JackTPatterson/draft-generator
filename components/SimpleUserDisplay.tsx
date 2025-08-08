"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut, User, RefreshCw, Mail, CheckCircle, XCircle } from "lucide-react"

export function SimpleUserDisplay() {
  const { data: session, isPending } = useSession()
  const [mounted, setMounted] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('SimpleUserDisplay - mounted:', mounted, 'isPending:', isPending, 'session:', session)
  }, [mounted, isPending, session])

  if (!mounted) {
    return <div className="p-2 text-sm text-gray-500">Loading...</div>
  }

  if (isPending) {
    return <div className="p-2 text-sm text-gray-500">Checking auth...</div>
  }

  if (!session?.user) {
    return (
      <div className="p-2 border rounded">
        <p className="text-sm text-gray-500 mb-2">Not signed in</p>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" asChild>
            <a href="/login">Sign In</a>
          </Button>
          <Button size="sm" asChild>
            <a href="/register">Sign Up</a>
          </Button>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST' })
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="p-3 border rounded bg-white">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8  rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {session.user.name || 'User'}
          </div>
          <div className="text-xs text-gray-500">
            {session.user.email}
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSignOut}
          className="w-full"
        >
          <LogOut className="w-3 h-3 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}