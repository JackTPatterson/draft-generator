import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, getCurrentUser } from '@/lib/auth-utils'
import { getMappedUserId } from '@/lib/user-mapping'

const EMAIL_MONITOR_BASE_URL = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Convert better-auth user ID to UUID format for microservice
    const mappedUserId = await getMappedUserId(userId)
    const response = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users/${mappedUserId}/email-monitoring`)
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    } else {
      const errorData = await response.json()
      return NextResponse.json({ error: errorData.error || 'Failed to get status' }, { status: response.status })
    }
  } catch (error) {
    console.error('Error fetching Gmail status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }


    // Convert better-auth user ID to UUID format for microservice
    let mappedUserId: string
    try {
      mappedUserId = await getMappedUserId(userId)
    } catch (mappingError) {
      console.error('Error mapping user ID:', mappingError)
      return NextResponse.json({ error: 'Failed to map user ID' }, { status: 500 })
    }
    
    const body = await request.json()
    const { action } = body

    if (action === 'connect') {
      console.log('Processing connect action...')
      
      // First ensure user exists in microservice database
      const user = await getCurrentUser(request)
      if (user) {
        try {
          // Ensure clean JSON payload
          const syncPayload = {
            id: mappedUserId,
            email: user.email,
            name: user.name || 'User'
          }
          
          console.log('Syncing user to backend:', syncPayload)
          
          const syncResponse = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncPayload)
          })
          
          console.log('User sync response:', syncResponse.status)
          
          if (!syncResponse.ok) {
            const errorText = await syncResponse.text()
            console.log('User sync error:', errorText)
          }
        } catch (syncError) {
          console.log('User sync failed:', syncError)
        }
      }
      
      // Get OAuth URL from microservice
      try {
        console.log('Getting OAuth URL from microservice at:', `${EMAIL_MONITOR_BASE_URL}/api/auth/gmail/${mappedUserId}`)
        
        const response = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/auth/gmail/${mappedUserId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })

        console.log('Microservice OAuth response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Microservice OAuth response data:', data)
          
          // Return the Google OAuth URL from microservice
          return NextResponse.json({
            success: true,
            auth_url: data.auth_url,
            message: 'Please complete Google OAuth to connect Gmail'
          })
        } else {
          const errorText = await response.text()
          console.error('Microservice OAuth error response:', errorText)
          
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          
          return NextResponse.json({ 
            error: errorData.error || 'Failed to get OAuth URL',
            details: errorText 
          }, { status: response.status })
        }
      } catch (fetchError) {
        console.error('Error getting OAuth URL from microservice:', fetchError)
        return NextResponse.json({ 
          error: 'Failed to connect to email monitoring service',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }, { status: 500 })
      }
    }

    if (action === 'disconnect') {
      const response = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users/${mappedUserId}/email-monitoring`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        return NextResponse.json(data)
      } else {
        const errorData = await response.json()
        return NextResponse.json({ error: errorData.error || 'Failed to disconnect' }, { status: response.status })
      }
    }


    if (action === 'enable_monitoring' || action === 'disable_monitoring') {
      // Use the frontend email-monitoring API which handles the microservice communication
      const frontendResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/email-monitoring`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || ''
        },
        body: JSON.stringify({
          action: action === 'enable_monitoring' ? 'enable' : 'disable',
          n8n_webhook_url: body.webhook_url || body.n8n_webhook_url,
          check_interval_minutes: body.check_interval || body.checkInterval || 5
        })
      })

      if (frontendResponse.ok) {
        const data = await frontendResponse.json()
        return NextResponse.json({
          success: true,
          monitoring_enabled: action === 'enable_monitoring',
          ...data
        })
      } else {
        const errorText = await frontendResponse.text()
        console.error('Frontend monitoring API error:', errorText)
        return NextResponse.json({ 
          error: 'Failed to toggle monitoring',
          details: errorText
        }, { status: frontendResponse.status })
      }
    }

    if (action === 'update') {
      // Use the frontend email-monitoring API to update configuration
      const frontendResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/email-monitoring`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || ''
        },
        body: JSON.stringify({
          action: 'update',
          n8n_webhook_url: body.webhook_url || body.n8n_webhook_url,
          check_interval_minutes: body.check_interval || body.checkInterval || 5
        })
      })

      if (frontendResponse.ok) {
        const data = await frontendResponse.json()
        return NextResponse.json({
          success: true,
          message: 'Configuration updated successfully',
          ...data
        })
      } else {
        const errorText = await frontendResponse.text()
        console.error('Frontend monitoring API error:', errorText)
        return NextResponse.json({ 
          error: 'Failed to update configuration',
          details: errorText
        }, { status: frontendResponse.status })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    console.error('Error in Gmail email monitor:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
      return NextResponse.json({ 
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}