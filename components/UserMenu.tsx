"use client"

import { useState } from "react"
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
import { useSession, signOut } from "@/lib/auth-client"
import { LogOut, Settings, User, Loader2 } from "lucide-react"

export function UserMenu() {
  const { data: session, isPending } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  console.log('UserMenu session:', session, 'isPending:', isPending) // Debug log

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

  const userInitials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
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
  )
}