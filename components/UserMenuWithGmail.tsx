"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {useSession, signOut, signIn} from "@/lib/auth-client"
import { LogOut, Settings, User, Loader2, Mail, CheckCircle, XCircle, RefreshCw } from "lucide-react"

export function UserMenuWithGmail() {
  const { data: session, isPending } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<any>(null)
  const [loadingGmail, setLoadingGmail] = useState(false)
  const router = useRouter()


  useEffect(() => {
    if (session?.user) {
      fetchGmailStatus()
    }
  }, [session])

  const fetchGmailStatus = async () => {
    try {
      setLoadingGmail(true)
      const response = await fetch('/api/gmail/connection')
      const data = await response.json()
      setGmailStatus(data)
    } catch (error) {
      console.error('Gmail Status Error:', error)
      setGmailStatus({ error: 'Failed to get Gmail status' })
    } finally {
      setLoadingGmail(false)
    }
  }


  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setIsSigningOut(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/login">Sign In</a>
        </Button>
        <Button size="sm" asChild>
          <a href="/register">Sign Up</a>
        </Button>
      </div>
    )
  }

  const userInitials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"

  return (
    <div className="space-y-3 ">
      {/* Gmail Status */}
      <div className="">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 p-1 rounded-full bg-white flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      <img src={'https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-02-512.png'}/>
                    </span>
            </div>
            <span className="text-sm font-medium">Gmail</span>
          </div>
          {loadingGmail ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : gmailStatus?.connected ? (
            <div className="h-2 w-2 rounded-full bg-green-500" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-red-500" />
          )}
        </div>
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start !py-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="text-sm font-medium">
                  {session.user.name || "User"}
                </div>
                <div className="text-xs text-gray-500">
                  {session.user.email}
                </div>
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session.user.name || "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}