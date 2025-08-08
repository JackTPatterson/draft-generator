import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      label_name,
      new_keywords = [],
      user_id = 'bab71c40-6151-424a-ba8c-c17f035c6e19',
      email_context = {},
      learning_mode = 'additive' // 'additive' or 'replace'
    } = body

    if (!label_name || !Array.isArray(new_keywords)) {
      return NextResponse.json(
        { error: 'Label name and keywords array are required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Find the label
      const labelQuery = await client.query(
        'SELECT id, n8n_trigger_keywords, n8n_sender_patterns, n8n_subject_patterns FROM email_labels WHERE name = $1 AND user_id = $2',
        [label_name, user_id]
      )

      if (labelQuery.rows.length === 0) {
        return NextResponse.json(
          { error: 'Label not found' },
          { status: 404 }
        )
      }

      const label = labelQuery.rows[0]
      const existingKeywords = label.n8n_trigger_keywords || []
      
      // Process new keywords - filter out duplicates and normalize
      const normalizedNewKeywords = new_keywords
        .map(keyword => keyword.toLowerCase().trim())
        .filter(keyword => keyword.length > 2) // Remove very short keywords
        .filter(keyword => !existingKeywords.includes(keyword)) // Remove duplicates

      // Combine keywords based on learning mode
      let updatedKeywords = []
      if (learning_mode === 'replace') {
        updatedKeywords = normalizedNewKeywords
      } else {
        // Additive mode - merge and deduplicate
        updatedKeywords = [...new Set([...existingKeywords, ...normalizedNewKeywords])]
      }

      // Limit total keywords to prevent bloat (keep most recent 50)
      if (updatedKeywords.length > 50) {
        updatedKeywords = updatedKeywords.slice(-50)
      }

      // Extract additional patterns from email context
      let updatedSenderPatterns = label.n8n_sender_patterns || []
      let updatedSubjectPatterns = label.n8n_subject_patterns || []

      if (email_context.from) {
        // Extract domain pattern from sender
        const emailMatch = email_context.from.match(/@([^\\s]+)/i)
        if (emailMatch) {
          const domain = emailMatch[1].toLowerCase()
          const domainPattern = `*@${domain}`
          if (!updatedSenderPatterns.includes(domainPattern)) {
            updatedSenderPatterns.push(domainPattern)
          }
        }
      }

      if (email_context.subject) {
        // Extract patterns from subject
        const subjectLower = email_context.subject.toLowerCase()
        const subjectKeywords = subjectLower.split(' ')
          .filter(word => word.length > 3)
          .filter(word => !updatedSubjectPatterns.includes(word))
          .slice(0, 3) // Limit to 3 new subject patterns per email

        updatedSubjectPatterns = [...updatedSubjectPatterns, ...subjectKeywords]
      }

      // Limit patterns
      if (updatedSenderPatterns.length > 20) {
        updatedSenderPatterns = updatedSenderPatterns.slice(-20)
      }
      if (updatedSubjectPatterns.length > 30) {
        updatedSubjectPatterns = updatedSubjectPatterns.slice(-30)
      }

      // Update the label with new patterns
      const updateResult = await client.query(`
        UPDATE email_labels 
        SET 
          n8n_trigger_keywords = $1,
          n8n_sender_patterns = $2,
          n8n_subject_patterns = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, n8n_trigger_keywords, n8n_sender_patterns, n8n_subject_patterns
      `, [
        updatedKeywords,
        updatedSenderPatterns,
        updatedSubjectPatterns,
        label.id
      ])

      // Log the learning activity
      await client.query(`
        INSERT INTO label_learning_log (
          label_id, user_id, learning_source, keywords_added, patterns_added, 
          email_context, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        label.id,
        user_id,
        'n8n_automated',
        normalizedNewKeywords,
        {
          sender_patterns: updatedSenderPatterns.slice(-5), // Last 5 added
          subject_patterns: updatedSubjectPatterns.slice(-5) // Last 5 added
        },
        email_context
      ]).catch(err => {
        // Log table might not exist yet, that's okay
        console.log('Could not log learning activity:', err.message)
      })

      const updatedLabel = updateResult.rows[0]

      return NextResponse.json({
        success: true,
        label_id: updatedLabel.id,
        label_name: updatedLabel.name,
        keywords_update: {
          before_count: existingKeywords.length,
          after_count: updatedLabel.n8n_trigger_keywords.length,
          new_keywords_added: normalizedNewKeywords,
          learning_mode: learning_mode
        },
        patterns_update: {
          sender_patterns: {
            before_count: (label.n8n_sender_patterns || []).length,
            after_count: updatedLabel.n8n_sender_patterns.length,
            new_patterns: updatedSenderPatterns.slice(-(updatedSenderPatterns.length - (label.n8n_sender_patterns || []).length))
          },
          subject_patterns: {
            before_count: (label.n8n_subject_patterns || []).length,
            after_count: updatedLabel.n8n_subject_patterns.length,
            new_patterns: updatedSubjectPatterns.slice(-(updatedSubjectPatterns.length - (label.n8n_subject_patterns || []).length))
          }
        },
        updated_label: {
          trigger_keywords: updatedLabel.n8n_trigger_keywords,
          sender_patterns: updatedLabel.n8n_sender_patterns,
          subject_patterns: updatedLabel.n8n_subject_patterns
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error updating label keywords:', error)
    return NextResponse.json(
      { error: 'Failed to update label keywords' },
      { status: 500 }
    )
  }
}

// Optional: Create learning log table if it doesn't exist
export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect()
    
    try {
      // Create learning log table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS label_learning_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          learning_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'n8n_automated', 'ai_suggested'
          keywords_added TEXT[],
          patterns_added JSONB,
          email_context JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)

      // Create index for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_label_learning_log_label_id 
        ON label_learning_log(label_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_label_learning_log_user_id 
        ON label_learning_log(user_id)
      `)

      return NextResponse.json({
        success: true,
        message: 'Label learning log table created/verified'
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error setting up learning log:', error)
    return NextResponse.json(
      { error: 'Failed to setup learning log' },
      { status: 500 }
    )
  }
}