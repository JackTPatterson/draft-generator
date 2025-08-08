"use client"

import { ReactNode } from "react"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Better-auth handles its own state management
  return <>{children}</>
}