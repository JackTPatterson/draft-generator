import { NextRequest, NextResponse } from 'next/server'
import { getEmailsWithExecutions } from '@/lib/database'
import { gmailService } from '@/lib/gmail-api'
import { getCurrentUserId } from '@/lib/auth-utils'
import pool from '@/lib/database'

// Helper function to get access token from better-auth
async function getGmailAccessToken(request: NextRequest): Promise<string | null> {
  try {
    const userId = await getCurrentUserId(request)
    if (!userId) {
      console.warn('No authenticated user found')
      return null
    }

    const client = await pool.connect()
    const result = await client.query(`
      SELECT access_token FROM gmail_tokens 
      WHERE user_id = $1 
      LIMIT 1
    `, [userId])
    
    client.release()

    if (result.rows.length === 0) {
      console.warn('No Gmail access token found for user')
      return null
    }
    
    return result.rows[0].access_token
  } catch (error) {
    console.error('Error reading Gmail access token:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gmail_id: string }> }
) {
  try {
    const { gmail_id } = await params

    if (!gmail_id) {
      return NextResponse.json(
        { error: 'Gmail ID is required' },
        { status: 400 }
      )
    }

    console.log(`Fetching email with gmail_id: ${gmail_id}`)

    // First check if we already have this email in our database
    const existingEmails = await getEmailsWithExecutions()
    const existingEmail = existingEmails.find(email => email.gmail_id === gmail_id)

    if (existingEmail) {
      console.log('Email found in database:', existingEmail.id)
      return NextResponse.json(existingEmail)
    }

    // If not in database, fetch from Gmail API
    console.log('Email not in database, fetching from Gmail API...')
    
    // Get access token from better-auth
    const accessToken = await getGmailAccessToken(request)
    if (!accessToken) {
      console.error('No Gmail access token available')
      return NextResponse.json(
        { error: 'Gmail authentication required. Please connect your Gmail account first.' },
        { status: 401 }
      )
    }
    
    // Initialize Gmail service
    try {
      await gmailService.initialize(accessToken)
    } catch (authError) {
      console.error('Gmail auth failed:', authError)
      return NextResponse.json(
        { error: 'Gmail authentication failed' },
        { status: 401 }
      )
    }

    const gmailMessage = await gmailService.getMessage(gmail_id)
    
    if (!gmailMessage) {
      return NextResponse.json(
        { error: 'Email not found in Gmail' },
        { status: 404 }
      )
    }

    // Transform Gmail message to our format
    const emailWithExecution = {
      id: parseInt(gmail_id.replace(/\D/g, '')) || Date.now(), // Generate numeric ID
      gmail_id: gmail_id,
      thread_id: gmailMessage.threadId,
      from: gmailMessage.from,
      email: gmailMessage.fromEmail,
      subject: gmailMessage.subject || 'No Subject',
      preview: gmailMessage.snippet || gmailMessage.body.substring(0, 100) + '...',
      time: gmailMessage.date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      important: gmailMessage.isImportant,
      unread: !gmailMessage.isRead,
      recipients: gmailMessage.to,
      cc: gmailMessage.cc,
      content: gmailMessage.body,
      attachments: gmailMessage.attachments.map(att => ({
        name: att.filename,
        size: `${(att.size / 1024).toFixed(1)}kb`
      })),
      execution: null // Will be populated if there's an execution record
    }

    console.log('Successfully fetched and transformed email from Gmail')
    return NextResponse.json(emailWithExecution)

  } catch (error) {
    console.error('Error fetching email by gmail_id:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to fetch email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}