import { google, gmail_v1 } from 'googleapis'

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload: {
    partId: string
    mimeType: string
    filename: string
    headers: Array<{
      name: string
      value: string
    }>
    body?: {
      attachmentId?: string
      size: number
      data?: string
    }
    parts?: Array<{
      partId: string
      mimeType: string
      filename: string
      headers: Array<{
        name: string
        value: string
      }>
      body: {
        attachmentId?: string
        size: number
        data?: string
      }
    }>
  }
  sizeEstimate: number
}

export interface ParsedEmail {
  id: string
  threadId: string
  subject: string
  from: string
  fromEmail: string
  to: string[]
  cc: string[]
  date: Date
  snippet: string
  body: string
  bodyHtml: string
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
  isRead: boolean
  isImportant: boolean
  labels: string[]
}

class GmailService {
  private gmail: gmail_v1.Gmail | null = null

  async initialize(accessToken: string): Promise<void> {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    
    this.gmail = google.gmail({ version: 'v1', auth })
  }

  async getMessage(messageId: string): Promise<ParsedEmail | null> {
    if (!this.gmail) {
      throw new Error('Gmail service not initialized')
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      })

      const message = response.data as GmailMessage
      return this.parseMessage(message)
    } catch (error) {
      console.error('Error fetching Gmail message:', error)
      return null
    }
  }

  async getThread(threadId: string): Promise<ParsedEmail[]> {
    if (!this.gmail) {
      throw new Error('Gmail service not initialized')
    }

    try {
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      })

      const thread = response.data
      const messages: ParsedEmail[] = []

      if (thread.messages) {
        for (const message of thread.messages) {
          const parsed = this.parseMessage(message as GmailMessage)
          if (parsed) {
            messages.push(parsed)
          }
        }
      }

      return messages
    } catch (error) {
      console.error('Error fetching Gmail thread:', error)
      return []
    }
  }

  private parseMessage(message: GmailMessage): ParsedEmail | null {
    try {
      const headers = message.payload.headers
      const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

      const subject = getHeader('Subject')
      const from = getHeader('From')
      const to = getHeader('To').split(',').map(email => email.trim())
      const cc = getHeader('Cc').split(',').map(email => email.trim()).filter(Boolean)
      const dateStr = getHeader('Date')
      
      // Parse from email
      const fromMatch = from.match(/<(.+)>/)
      const fromEmail = fromMatch ? fromMatch[1] : from
      const fromName = fromMatch ? from.replace(/<.*>/, '').trim().replace(/"/g, '') : from

      // Get body content
      let body = ''
      let bodyHtml = ''
      
      if (message.payload.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
      } else if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8')
          } else if (part.mimeType === 'text/html' && part.body.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
          }
        }
      }

      // Get attachments
      const attachments: Array<{
        filename: string
        mimeType: string
        size: number
        attachmentId: string
      }> = []

      if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.filename && part.body.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            })
          }
        }
      }

      // Check if read/important based on labels
      const labels = message.labelIds || []
      const isRead = !labels.includes('UNREAD')
      const isImportant = labels.includes('IMPORTANT')

      return {
        id: message.id,
        threadId: message.threadId,
        subject,
        from: fromName || fromEmail,
        fromEmail,
        to,
        cc,
        date: new Date(dateStr),
        snippet: message.snippet,
        body: body || this.stripHtml(bodyHtml),
        bodyHtml,
        attachments,
        isRead,
        isImportant,
        labels
      }
    } catch (error) {
      console.error('Error parsing message:', error)
      return null
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  }
}

export const gmailService = new GmailService()