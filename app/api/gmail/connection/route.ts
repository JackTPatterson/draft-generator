import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'
import { getGmailConnectionStatus, syncGmailTokensFromAccount, disconnectGmailAccount } from '@/lib/gmail-better-auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const status = await getGmailConnectionStatus(userId)
    
    return NextResponse.json({
      success: true,
      ...status
    })
  } catch (error) {
    console.error('Error getting Gmail connection status:', error)
    return NextResponse.json(
      { error: 'Failed to get Gmail connection status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'sync') {
      const tokens = await syncGmailTokensFromAccount(userId)
      
      if (!tokens) {
        return NextResponse.json(
          { error: 'No Google account found or failed to sync tokens' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Gmail tokens synced successfully',
        tokens: {
          expires_at: tokens.expires_at
        }
      })
    }

    if (action === 'disconnect') {
      const result = await disconnectGmailAccount(userId)
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to disconnect Gmail account' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Gmail account disconnected successfully'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error handling Gmail connection action:', error)
    return NextResponse.json(
      { error: 'Failed to handle Gmail connection action' },
      { status: 500 }
    )
  }
}