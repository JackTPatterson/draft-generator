import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email_data,
      detected_labels = [],
      primary_label,
      user_id = 'bab71c40-6151-424a-ba8c-c17f035c6e19'
    } = body

    if (!email_data) {
      return NextResponse.json(
        { error: 'Email data is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      let suggestedTemplates = []

      if (detected_labels.length > 0) {
        // Get templates associated with detected labels
        const labelNames = detected_labels.map(label => label.name)
        
        const templatesQuery = `
          SELECT
            et.id,
            et.name,
            et.description,
            et.category,
            et.type,
            et.tone,
            et.subject_template,
            et.body_template,
            et.ai_instructions,
            et.template_ai_instructions,
            et.variables,
            et.tags,
            tla.priority_score,
            tla.auto_suggest,
            tla.auto_apply,
            el.name as label_name,
            el.color as label_color
          FROM email_templates et
          JOIN template_label_associations tla ON et.id = tla.template_id
          JOIN email_labels el ON tla.label_id = el.id
          WHERE el.name = ANY($1)
            AND el.user_id::text = $2
            AND et.user_id = $2
            AND tla.auto_suggest = true
            AND el.is_active = true
          ORDER BY tla.priority_score DESC, et.created_at DESC
        `

        const templatesResult = await client.query(templatesQuery, [labelNames, user_id])
        suggestedTemplates = templatesResult.rows

        // If no specific templates found, get general templates from the primary category
        if (suggestedTemplates.length === 0 && primary_label) {
          const generalQuery = `
            SELECT
              et.id,
              et.name,
              et.description,
              et.category,
              et.type,
              et.tone,
              et.subject_template,
              et.body_template,
              et.ai_instructions,
            et.template_ai_instructions,
              et.template_ai_instructions,
              et.variables,
              et.tags,
              1 as priority_score,
              true as auto_suggest,
              false as auto_apply,
              $3 as label_name,
              '#6B7280' as label_color
            FROM email_templates et
            WHERE et.user_id = $1
              AND et.category ILIKE $2
            ORDER BY et.created_at DESC
            LIMIT 3
          `

          const generalResult = await client.query(generalQuery, [
            user_id, 
            `%${primary_label}%`,
            primary_label
          ])
          suggestedTemplates = generalResult.rows
        }
      }

      // If still no templates, get most popular general templates
      if (suggestedTemplates.length === 0) {
        const fallbackQuery = `
          SELECT
            et.id,
            et.name,
            et.description,
            et.category,
            et.type,
            et.tone,
            et.subject_template,
            et.body_template,
            et.ai_instructions,
            et.template_ai_instructions,
            et.variables,
            et.tags,
            1 as priority_score,
            true as auto_suggest,
            false as auto_apply,
            'General' as label_name,
            '#6B7280' as label_color
          FROM email_templates et
          WHERE et.user_id = $1
          ORDER BY et.created_at DESC
          LIMIT 5
        `

        const fallbackResult = await client.query(fallbackQuery, [user_id])
        suggestedTemplates = fallbackResult.rows
      }

      // Analyze email content for additional context
      const emailAnalysis = {
        has_urgency_keywords: /urgent|asap|emergency|critical|immediate/i.test(
          `${email_data.subject} ${email_data.body}`
        ),
        has_question_markers: /\?|how|what|when|where|why|can you|could you/i.test(
          `${email_data.subject} ${email_data.body}`
        ),
        estimated_sentiment: email_data.body ? 
          (email_data.body.includes('thank') || email_data.body.includes('appreciate') ? 'positive' :
           email_data.body.includes('issue') || email_data.body.includes('problem') ? 'negative' : 'neutral') : 'neutral',
        word_count: email_data.body ? email_data.body.split(' ').length : 0
      }

      return NextResponse.json({
        success: true,
        suggested_templates: suggestedTemplates,
        template_count: suggestedTemplates.length,
        email_analysis: emailAnalysis,
        matching_strategy: suggestedTemplates.length > 0 ? 
          (detected_labels.length > 0 ? 'label_based' : 'category_based') : 'fallback',
        recommendations: {
          primary_template: suggestedTemplates[0] || null,
          alternative_templates: suggestedTemplates.slice(1, 4),
          confidence_score: Math.min(detected_labels.length * 0.3, 1.0)
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error getting suggested templates:', error)
    return NextResponse.json(
      { error: 'Failed to get suggested templates' },
      { status: 500 }
    )
  }
}