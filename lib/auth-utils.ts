import { auth } from "@/app/auth"
import { NextRequest } from "next/server"
import { headers } from "next/headers"

/**
 * Get the current user ID from better-auth session
 * For use in API routes and server components
 */
export async function getCurrentUserId(request?: NextRequest): Promise<string | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    return session?.user?.id || null
  } catch (error) {
    console.error('Error getting current user ID:', error)
    return null
  }
}

/**
 * Get the current user from better-auth session
 * For use in API routes and server components
 */
export async function getCurrentUser(request?: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    return session?.user || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Middleware to require authentication in API routes
 */
export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request)
  
  if (!user) {
    return Response.json(
      { error: 'Authentication required' }, 
      { status: 401 }
    )
  }
  
  return { user, userId: user.id }
}