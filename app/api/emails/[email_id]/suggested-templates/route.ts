import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { email_id: string } }
) {
  try {
    const emailId = params.email_id
    const { searchParams } = new URL(request.url)
    const includeAutoApply = searchParams.get('includeAutoApply') === 'true'
    const limit = parseInt(searchParams.get('limit') || '5')

    const client = await pool.connect()
    
    try {
      // Get suggested templates based on email labels
      const result = await client.query(`
        SELECT DISTINCT
          et.id as template_id,
          et.name as template_name,
          et.description as template_description,
          et.category as template_category,
          et.type as template_type,
          et.tone as template_tone,
          et.subject_template,
          et.body_template,
          et.ai_instructions,
          et.variables,
          et.tags,
          et.usage_count,
          et.last_used_at,
          tla.priority_score,
          tla.auto_suggest,
          tla.auto_apply,
          el.name as label_name,
          el.color as label_color,
          el.icon as label_icon,
          COUNT(*) OVER (PARTITION BY et.id) as matching_labels_count
        FROM email_label_associations ela
        JOIN email_labels el ON ela.label_id = el.id
        JOIN template_label_associations tla ON el.id = tla.label_id
        JOIN email_templates et ON tla.template_id = et.id
        WHERE ela.email_id = $1
          AND el.is_active = TRUE
          AND et.is_active = TRUE
          AND tla.auto_suggest = TRUE
          ${includeAutoApply ? '' : 'AND tla.auto_apply = FALSE'}
        ORDER BY 
          tla.priority_score DESC,
          matching_labels_count DESC,
          et.usage_count DESC,
          et.last_used_at DESC NULLS LAST
        LIMIT $2
      `, [emailId, limit])

      // Group templates by template_id and collect associated labels
      const templateMap = new Map()
      
      result.rows.forEach(row => {
        const templateId = row.template_id
        
        if (!templateMap.has(templateId)) {
          templateMap.set(templateId, {
            id: row.template_id,
            name: row.template_name,
            description: row.template_description,
            category: row.template_category,
            type: row.template_type,
            tone: row.template_tone,
            subject_template: row.subject_template,
            body_template: row.body_template,
            ai_instructions: row.ai_instructions,
            variables: row.variables,
            tags: row.tags,
            usage_count: row.usage_count,
            last_used_at: row.last_used_at,
            matching_labels: [],
            max_priority_score: row.priority_score,
            auto_apply: row.auto_apply,
            matching_labels_count: row.matching_labels_count
          })
        }

        const template = templateMap.get(templateId)
        template.matching_labels.push({
          name: row.label_name,
          color: row.label_color,
          icon: row.label_icon,
          priority_score: row.priority_score
        })

        // Keep track of highest priority score
        if (row.priority_score > template.max_priority_score) {
          template.max_priority_score = row.priority_score
        }
      })

      const suggestedTemplates = Array.from(templateMap.values())

      // Get auto-apply templates separately if requested
      let autoApplyTemplates = []
      if (includeAutoApply) {
        const autoApplyResult = await client.query(`
          SELECT DISTINCT
            et.id as template_id,
            et.name as template_name,
            et.subject_template,
            et.body_template,
            et.ai_instructions,
            et.variables,
            tla.priority_score,
            el.name as label_name
          FROM email_label_associations ela
          JOIN email_labels el ON ela.label_id = el.id
          JOIN template_label_associations tla ON el.id = tla.label_id
          JOIN email_templates et ON tla.template_id = et.id
          WHERE ela.email_id = $1
            AND el.is_active = TRUE
            AND et.is_active = TRUE
            AND tla.auto_apply = TRUE
          ORDER BY tla.priority_score DESC
          LIMIT 3
        `, [emailId])

        autoApplyTemplates = autoApplyResult.rows
      }

      return NextResponse.json({
        success: true,
        email_id: emailId,
        suggested_templates: suggestedTemplates,
        auto_apply_templates: autoApplyTemplates,
        total_suggestions: suggestedTemplates.length,
        metadata: {
          generated_at: new Date().toISOString(),
          include_auto_apply: includeAutoApply,
          limit_applied: limit
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error fetching suggested templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggested templates' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { email_id: string } }
) {
  try {
    const emailId = params.email_id
    const body = await request.json()
    const {
      templateId,
      customPrompt,
      userId = 'demo-user'
    } = body

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Get the template details
      const templateResult = await client.query(`
        SELECT 
          et.*,
          string_agg(el.name, ', ') as associated_labels
        FROM email_templates et
        LEFT JOIN template_label_associations tla ON et.id = tla.template_id
        LEFT JOIN email_labels el ON tla.label_id = el.id
        WHERE et.id = $1 AND et.is_active = TRUE
        GROUP BY et.id
      `, [templateId])

      if (templateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Template not found or inactive' },
          { status: 404 }
        )
      }

      const template = templateResult.rows[0]

      // Get email details
      const emailResult = await client.query(`
        SELECT 
          e.*,
          string_agg(el.name, ', ') as email_labels
        FROM emails e
        LEFT JOIN email_label_associations ela ON e.id = ela.email_id
        LEFT JOIN email_labels el ON ela.label_id = el.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [emailId])

      if (emailResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        )
      }

      const email = emailResult.rows[0]

      // Generate draft using the selected template
      const draftResponse = await generateDraftFromTemplate(
        email,
        template,
        customPrompt
      )

      // Update template usage statistics
      await client.query(`
        UPDATE email_templates 
        SET usage_count = usage_count + 1, last_used_at = NOW()
        WHERE id = $1
      `, [templateId])

      return NextResponse.json({
        success: true,
        email_id: emailId,
        template_id: templateId,
        draft_content: draftResponse.content,
        template_used: {
          name: template.name,
          category: template.category,
          type: template.type,
          tone: template.tone,
          associated_labels: template.associated_labels
        },
        metadata: {
          email_labels: email.email_labels,
          custom_prompt_used: !!customPrompt,
          generated_at: new Date().toISOString(),
          variables_used: draftResponse.variables_used
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error generating draft from template:', error)
    return NextResponse.json(
      { error: 'Failed to generate draft from template' },
      { status: 500 }
    )
  }
}

async function generateDraftFromTemplate(
  email: any,
  template: any,
  customPrompt?: string
): Promise<{ content: string; variables_used: string[] }> {
  // Extract variables from template
  const variableMatches = template.body_template.match(/\[([A-Z_][A-Z0-9_]*)\]/g) || []
  const variables = variableMatches.map((match: string) => match.slice(1, -1))
  
  let content = template.body_template
  let subjectContent = template.subject_template || `Re: ${email.subject}`
  
  // Basic variable substitutions (in production, this would be more sophisticated)
  const variableValues: { [key: string]: string } = {
    'FROM_NAME': email.from_name || 'Sender',
    'SENDER_EMAIL': email.from_email || '',
    'SUBJECT': email.subject || '',
    'COMPANY_NAME': 'Fluxyn',
    'DATE': new Date().toLocaleDateString(),
    'TIME': new Date().toLocaleTimeString(),
    'RECIPIENT_NAME': email.from_name?.split(' ')[0] || 'Colleague'
  }

  // Replace variables in both subject and body
  variables.forEach((variable: any) => {
    const value = variableValues[variable] || `[${variable}]`
    content = content.replace(new RegExp(`\\[${variable}\\]`, 'g'), value)
    subjectContent = subjectContent.replace(new RegExp(`\\[${variable}\\]`, 'g'), value)
  })

  // Add AI instructions if present
  if (template.ai_instructions) {
    content += `\n\n<!-- AI Instructions: ${template.ai_instructions} -->`
  }

  // Add custom prompt modifications if provided
  if (customPrompt) {
    content += `\n\n<!-- Custom Request: ${customPrompt} -->`
  }

  // Format final email content
  const finalContent = `Subject: ${subjectContent}\n\n${content}`

  return {
    content: finalContent,
    variables_used: Object.keys(variableValues).filter(key => variables.includes(key))
  }
}