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
  template_used?: {
    id: string;
    name: string;
    category: string;
    type: string;
    tone: string;
  };
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
                JSONB_AGG(
                jsonb_build_object(
                    'id', ed.id,
                    'gmail_id', ed.gmail_id,
                    'created_at', ed.created_at,
                    'model_used', ed.model_used,
                    'draft_content', ed.draft_content,
                    'draft_id', ed.draft_id,
                    'citations', ed.citations,
                    'used_citations', ed.used_citations,
                    'knowledge_sources_count', ed.knowledge_sources_count,
                    'status', ed.status,
                    'template_used',
                    CASE
                      WHEN et.id IS NOT NULL THEN jsonb_build_object(
                          'id', et.id,
                          'name', et.name,
                          'category', et.category,
                          'type', et.type,
                          'tone', et.tone
                                                  )
                      ELSE NULL
                      END
                )
                ORDER BY ed.created_at DESC
                         )
                FILTER (WHERE ed.gmail_id IS NOT NULL),
                '[]'
        ) AS drafts
      FROM email_executions AS ee
             LEFT JOIN email_drafts AS ed
                       ON ed.gmail_id = ee.gmail_id
             LEFT JOIN email_templates AS et
                       ON ed.template_id = et.id
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
                                                 JSONB_AGG(
                                                 jsonb_build_object(
                                                     'id', ed.id,
                                                     'gmail_id', ed.gmail_id,
                                                     'created_at', ed.created_at,
                                                     'model_used', ed.model_used,
                                                     'draft_content', ed.draft_content,
                                                     'draft_id', ed.draft_id,
                                                     'citations', ed.citations,
                                                     'used_citations', ed.used_citations,
                                                     'knowledge_sources_count', ed.knowledge_sources_count,
                                                     'status', ed.status,
                                                     'template_used',
                                                     CASE
                                                       WHEN et.id IS NOT NULL THEN jsonb_build_object(
                                                           'id', et.id,
                                                           'name', et.name,
                                                           'category', et.category,
                                                           'type', et.type,
                                                           'tone', et.tone
                                                                                   )
                                                       ELSE NULL
                                                       END
                                                 )
                                                 ORDER BY ed.created_at DESC
                                                          )
                                                 FILTER (WHERE ed.gmail_id IS NOT NULL),
                                                 '[]'
                                         ) AS drafts
                                       FROM email_executions AS ee
                                              LEFT JOIN email_drafts AS ed
                                                        ON ed.gmail_id = ee.gmail_id
                                              LEFT JOIN email_templates AS et
                                                        ON ed.template_used = et.id::text
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
                                       LIMIT 20`)


    return result.rows
  } finally {
    client.release()
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