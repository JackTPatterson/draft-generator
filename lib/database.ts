import {Pool, QueryResult} from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export interface Citation {
  id: string;
  label: string;
  title: string;
  category?: string;
  section?: string;
  type: 'document' | 'chunk';
  relevanceScore: number;
  snippet?: string;
  text?: string;
}

export interface EmailDraft {
  id: number;
  gmail_id: string;
  created_at: string;
  model_used: string | null;
  draft_content: string;
  draft_id: string;
  citations?: {sources:  Citation[] }
  used_citations?: string[];
  knowledge_sources_count?: number;
  status?: 'draft' | 'accepted' | 'rejected';
}

export interface EmailExecution {
  id: string
  gmail_id: string
  thread_id: string
  execution_status: string
  processed_at: Date | null
  created_at: Date
  updated_at: Date
  drafts: EmailDraft[]
}

export interface EmailWithExecution {
  id: number
  gmail_id?: string
  thread_id?: string
  from: string
  email: string
  subject: string
  preview: string
  time: string
  important: boolean
  unread: boolean
  recipients: string[]
  cc: string[]
  content: string
  attachments: Array<{ name: string; size: string }>
  execution?: EmailExecution
}

export async function getEmailExecutions(): Promise<EmailExecution[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT
        ee.id,
        ee.gmail_id,
        ee.thread_id,
        ee.execution_status,
        ee.processed_at,
        ee.created_at,
        ee.updated_at,
        COALESCE(
                JSONB_AGG( TO_JSONB(ed) ORDER BY ed.created_at DESC )
                FILTER ( WHERE ed.gmail_id IS NOT NULL ),
                '[]'
        ) AS drafts
      FROM email_executions AS ee
             LEFT JOIN email_drafts     AS ed
                       ON ed.gmail_id = ee.gmail_id
      GROUP BY
        ee.id,
        ee.gmail_id,
        ee.thread_id,
        ee.execution_status,
        ee.processed_at,
        ee.created_at,
        ee.updated_at
      ORDER BY
        ee.created_at DESC
      LIMIT 20
      `)
    return result.rows
  } finally {
    client.release()
  }
}

export async function getEmailsWithExecutions(): Promise<EmailExecution[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(`SELECT
                                         ee.id,
                                         ee.gmail_id,
                                         ee.thread_id,
                                         ee.execution_status,
                                         ee.processed_at,
                                         ee.created_at,
                                         ee.updated_at,
                                         COALESCE(
                                                 JSONB_AGG(TO_JSONB(ed) ORDER BY ed.created_at DESC)
                                                 FILTER (WHERE ed.gmail_id IS NOT NULL),
                                                 '[]'
                                         ) AS drafts
                                       FROM email_executions AS ee
                                              LEFT JOIN email_drafts AS ed
                                                        ON ed.gmail_id = ee.gmail_id
                                       GROUP BY
                                         ee.id,
                                         ee.gmail_id,
                                         ee.thread_id,
                                         ee.execution_status,
                                         ee.processed_at,
                                         ee.created_at,
                                         ee.updated_at
                                       ORDER BY
                                         ee.created_at DESC
                                       LIMIT 20;
    `)

    console.log('Emails with executions:', result.rows)

    return result.rows
  } finally {
    client.release()
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

export default pool


export async function deleteEmailExecutions(gmailIds: string[]): Promise<number> {
  if (!gmailIds || gmailIds.length === 0) return 0

  const client = await pool.connect()
  try {
    const result: QueryResult = await client.query(
        `
      DELETE FROM email_executions
      WHERE gmail_id = ANY($1::text[])
      `,
        [gmailIds]
    )
    return result.rowCount ?? 0
  } finally {
    client.release()
  }
}