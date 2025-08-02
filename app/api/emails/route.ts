import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {getEmailsWithExecutions, type EmailExecution, deleteEmailExecutions} from '@/lib/database'
import { gmailService, type ParsedEmail } from '@/lib/gmail-api'

// Helper function to get access token from cookies
async function getGmailAccessToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('gmail_access_token')?.value
    
    if (!accessToken) {
      console.warn('No Gmail access token found in cookies')
      return null
    }
    
    return accessToken
  } catch (error) {
    console.error('Error reading Gmail access token from cookies:', error)
    return null
  }
}

function formatTime(date: Date | null): string {
  if (!date) return 'Unknown'
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  
  if (hours < 24) {
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}m ago`
    }
    return `${hours}h ago`
  } else if (hours < 48) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString()
  }
}

export async function GET() {
  try {
    // Get email executions from database
    const executions = await getEmailsWithExecutions()
    
    // Get Gmail access token
    const accessToken = await getGmailAccessToken()


    if (!accessToken) {
      console.warn('No Gmail access token available, returning executions without email details')
      return NextResponse.json(
        executions.map((exec, index) => ({
          id: index + 1,
          gmail_id: exec.gmail_id,
          thread_id: exec.thread_id,
          from: 'Unknown',
          email: 'unknown@example.com',
          subject: `Email ${exec.gmail_id}`,
          preview: 'Gmail access not configured',
          time: formatTime(exec.created_at),
          important: false,
          unread: exec.execution_status === 'pending',
          recipients: [],
          cc: [],
          content: 'Gmail API not configured. Please set up OAuth access.',
          attachments: [],
          execution: exec
        }))
      )
    }

    // Initialize Gmail service
    await gmailService.initialize(accessToken)

    // Fetch Gmail message details for each execution
    const emailsWithDetails = await Promise.all(
      executions.map(async (execution, index) => {
        try {
          if (!execution.gmail_id) {
            return {
              id: index + 1,
              gmail_id: execution.gmail_id,
              thread_id: execution.thread_id,
              from: 'System',
              email: 'system@fluxyn.com',
              subject: 'Email Execution Record',
              preview: 'No Gmail ID associated with this execution',
              time: formatTime(execution.created_at),
              important: false,
              unread: execution.execution_status === 'pending',
              recipients: [],
              cc: [],
              content: `Execution Status: ${execution.execution_status}\nProcessed: ${execution.processed_at || 'Not processed'}`,
              attachments: [],
              execution
            }
          }

          const gmailMessage = await gmailService.getMessage(execution.gmail_id)
          
          if (!gmailMessage) {
            return {
              id: index + 1,
              gmail_id: execution.gmail_id,
              thread_id: execution.thread_id,
              from: 'Unknown',
              email: 'unknown@example.com',
              subject: `Email ${execution.gmail_id}`,
              preview: 'Failed to fetch email details from Gmail',
              time: formatTime(execution.created_at),
              important: false,
              unread: execution.execution_status === 'pending',
              recipients: [],
              cc: [],
              content: 'Failed to fetch email content from Gmail API',
              attachments: [],
              execution
            }
          }

          return {
            id: index + 1,
            gmail_id: execution.gmail_id,
            thread_id: execution.thread_id,
            from: gmailMessage.from,
            email: gmailMessage.fromEmail,
            subject: gmailMessage.subject,
            preview: gmailMessage.snippet,
            time: formatTime(gmailMessage.date),
            important: gmailMessage.isImportant,
            unread: !gmailMessage.isRead,
            recipients: gmailMessage.to,
            cc: gmailMessage.cc,
            content: gmailMessage.body,
            attachments: gmailMessage.attachments.map(att => ({
              name: att.filename,
              size: `${Math.round(att.size / 1024)}kb`
            })),
            execution
          }
        } catch (error) {
          console.error(`Error fetching Gmail message ${execution.gmail_id}:`, error)
          return {
            id: index + 1,
            gmail_id: execution.gmail_id,
            thread_id: execution.thread_id,
            from: 'Error',
            email: 'error@gmail.com',
            subject: `Error fetching ${execution.gmail_id}`,
            preview: 'Failed to fetch email from Gmail',
            time: formatTime(execution.created_at),
            important: false,
            unread: execution.execution_status === 'pending',
            recipients: [],
            cc: [],
            content: `Error fetching email content: ${error instanceof Error ? error.message : 'Unknown error'}`,
            attachments: [],
            execution
          }
        }
      })
    )

    return NextResponse.json(emailsWithDetails)
  } catch (error) {
    console.error('Failed to fetch emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails from database' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const gmailIds: string[] = body.gmail_ids

    if (!Array.isArray(gmailIds) || gmailIds.length === 0) {
      return NextResponse.json({ error: 'gmail_ids must be a non-empty array' }, { status: 400 })
    }

    // Delete from your database
    const deleted = await deleteEmailExecutions(gmailIds)

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error('Error deleting emails:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}