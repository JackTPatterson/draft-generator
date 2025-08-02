import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

// This is a test endpoint to demonstrate how to create drafts with citations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gmail_id } = body

    if (!gmail_id) {
      return NextResponse.json({ 
        error: 'gmail_id is required' 
      }, { status: 400 })
    }

    const client = await pool.connect()
    
    try {
      // First, ensure email_executions and email_drafts tables exist
      // Create them if they don't exist (for testing purposes)
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          gmail_id VARCHAR(255),
          thread_id VARCHAR(255),
          execution_status VARCHAR(50) DEFAULT 'pending',
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS email_drafts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          gmail_id VARCHAR(255) REFERENCES email_executions(gmail_id),
          draft_content TEXT NOT NULL,
          draft_id VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
          model_used VARCHAR(100),
          citations JSONB,
          used_citations TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)

      // Create or update execution record
      const executionResult = await client.query(`
        INSERT INTO email_executions (gmail_id, execution_status, created_at, updated_at)
        VALUES ($1, 'running', NOW(), NOW())
        ON CONFLICT (gmail_id) DO UPDATE SET
          execution_status = 'running',
          updated_at = NOW()
        RETURNING id
      `, [gmail_id])

      // Generate sample draft content with citations
      const draftWithCitations = `Thank you for your inquiry about our data privacy practices.

I'm happy to provide you with comprehensive information about how we handle and protect your data.

Our platform implements robust security measures [Source 1] including end-to-end encryption, multi-factor authentication, and regular security audits. According to our data privacy policy [Source 2], we maintain strict GDPR compliance standards and hold SOC 2 Type II certification.

Key privacy protections include:
- Data minimization practices as outlined in our guidelines [Source 1]
- Purpose limitation ensuring data is only used for intended purposes [Source 2]
- Storage limitation with automatic data retention policies [Source 1]

If you have any specific questions about our privacy practices or need additional documentation, please don't hesitate to reach out.

Best regards,
[Your Name]`

      // Sample citations that match the content
      const citations = [
        {
          id: 'source-1',
          label: 'Source 1',
          title: 'Data Privacy and Security Policy',
          category: 'Legal Documents',
          type: 'document',
          relevanceScore: 0.94,
          snippet: 'Our company is committed to protecting the privacy and security of customer data. This document outlines our comprehensive approach to data protection including end-to-end encryption, multi-factor authentication, and regular security audits.'
        },
        {
          id: 'source-2',
          label: 'Source 2',
          title: 'GDPR Compliance Guidelines',
          category: 'Legal Documents',
          type: 'document',
          relevanceScore: 0.89,
          snippet: 'We maintain strict GDPR compliance standards with SOC 2 Type II certification. All data processing follows the principles of data minimization, purpose limitation, and storage limitation.'
        }
      ]

      const usedCitations = ['source-1', 'source-2']

      // Insert the draft with citations
      const draftResult = await client.query(`
        INSERT INTO email_drafts (gmail_id, draft_content, model_used, citations, used_citations, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, draft_id
      `, [
        gmail_id,
        draftWithCitations,
        'gpt-4',
        JSON.stringify(citations),
        usedCitations
      ])

      // Update execution status to completed
      await client.query(`
        UPDATE email_executions 
        SET execution_status = 'completed', processed_at = NOW(), updated_at = NOW()
        WHERE gmail_id = $1
      `, [gmail_id])

      return NextResponse.json({
        success: true,
        message: 'Draft created with citations',
        gmail_id,
        draft_id: draftResult.rows[0].draft_id,
        execution_id: executionResult.rows[0].id,
        citations_count: citations.length,
        used_citations_count: usedCitations.length,
        preview: draftWithCitations.substring(0, 200) + '...'
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error creating test draft:', error)
    return NextResponse.json({ 
      error: 'Failed to create test draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to show example
export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint for creating drafts with citations',
    usage: 'POST with { "gmail_id": "test-email-123" } to create a sample draft',
    example_citation_format: '[Source 1], [Source 2], [Ref 1]',
    note: 'This creates a sample draft with properly formatted citations that will show up as source badges in the UI'
  })
}