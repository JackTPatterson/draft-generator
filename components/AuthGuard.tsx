"use client"

import { useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = "/login" 
}: AuthGuardProps) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending) {
      if (requireAuth && !session?.user) {
        router.push(redirectTo)
      } else if (!requireAuth && session?.user) {
        router.push("/dashboard")
      }
    }
  }, [session, isPending, requireAuth, redirectTo, router])

  // Show loading spinner while checking authentication
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // If auth is required but user is not authenticated, don't render children
  if (requireAuth && !session?.user) {
    return null
  }

  // If auth is not required but user is authenticated, don't render children  
  if (!requireAuth && session?.user) {
    return null
  }

  return <>{children}</>
}