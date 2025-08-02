import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      gmail_id,
      thread_id,
      from_email,
      from_name,
      to_emails,
      cc_emails,
      subject,
      body_text,
      body_html,
      received_at,
      labels = [],
      user_id = 'demo-user',
      webhook_source = 'n8n',
      processing_mode = 'auto' // 'auto', 'suggest_only', 'manual'
    } = body

    if (!gmail_id) {
      return NextResponse.json(
        { error: 'gmail_id is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // 1. Store/update the email
      const emailResult = await client.query(`
        INSERT INTO emails (
          user_id, gmail_message_id, gmail_thread_id, from_email, from_name,
          to_emails, cc_emails, subject, body_text, body_html, received_at,
          webhook_source, webhook_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id, gmail_message_id) 
        DO UPDATE SET
          from_email = EXCLUDED.from_email,
          from_name = EXCLUDED.from_name,
          subject = EXCLUDED.subject,
          body_text = EXCLUDED.body_text,
          body_html = EXCLUDED.body_html,
          updated_at = NOW()
        RETURNING id
      `, [
        user_id, gmail_id, thread_id, from_email, from_name,
        JSON.stringify(to_emails), JSON.stringify(cc_emails),
        subject, body_text, body_html, received_at,
        webhook_source, JSON.stringify(body)
      ])

      const emailId = emailResult.rows[0].id

      // 2. Apply n8n email rules and automatic labeling
      const ruleResults = await applyEmailRules(
        client,
        user_id,
        emailId,
        from_email,
        subject,
        body_text || body_html || ''
      )

      // 3. Add any explicitly provided labels
      if (labels && labels.length > 0) {
        await addLabelsToEmail(client, emailId, labels, 'n8n')
      }

      // 4. Get suggested templates based on assigned labels
      const templateSuggestions = await getSuggestedTemplates(client, emailId)

      // 5. Auto-apply templates if configured
      let autoAppliedTemplate = null
      if (processing_mode === 'auto' && templateSuggestions.auto_apply_templates.length > 0) {
        const topTemplate = templateSuggestions.auto_apply_templates[0]
        autoAppliedTemplate = await generateDraftFromTemplate(
          client,
          emailId,
          topTemplate.template_id,
          'n8n_auto_apply'
        )
      }

      await client.query('COMMIT')

      // 6. Prepare response
      const response = {
        success: true,
        email_processing_result: {
          email_id: emailId,
          gmail_id,
          processed_at: new Date().toISOString(),
          applied_rules: ruleResults.applied_rules,
          assigned_labels: ruleResults.assigned_labels,
          explicit_labels: labels,
          template_suggestions: templateSuggestions.suggested_templates,
          auto_applied_template: autoAppliedTemplate,
          processing_mode,
          next_actions: []
        }
      }

      // Add next action recommendations
      if (templateSuggestions.suggested_templates.length > 0 && !autoAppliedTemplate) {
        response.email_processing_result.next_actions.push({
          action: 'review_template_suggestions',
          description: `${templateSuggestions.suggested_templates.length} templates suggested based on email labels`,
          api_endpoint: `/api/emails/${emailId}/suggested-templates`
        })
      }

      if (ruleResults.assigned_labels.length > 0) {
        response.email_processing_result.next_actions.push({
          action: 'verify_label_assignment',
          description: `Email automatically labeled with: ${ruleResults.assigned_labels.join(', ')}`,
          api_endpoint: `/api/emails/${emailId}/labels`
        })
      }

      return NextResponse.json(response)

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error processing email via n8n webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function applyEmailRules(
  client: any,
  userId: string,
  emailId: string,
  fromEmail: string,
  subject: string,
  bodyText: string
) {
  const appliedRules: any[] = []
  const assignedLabels: string[] = []

  try {
    // Get active n8n rules for this user
    const rulesResult = await client.query(`
      SELECT * FROM n8n_email_rules 
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY id
    `, [userId])

    for (const rule of rulesResult.rows) {
      const conditions = rule.conditions
      const actions = rule.actions
      let ruleMatches = true

      // Check sender patterns
      if (conditions.sender_patterns && conditions.sender_patterns.length > 0) {
        const senderMatches = conditions.sender_patterns.some((pattern: string) => {
          try {
            return new RegExp(pattern, 'i').test(fromEmail)
          } catch {
            return fromEmail.toLowerCase().includes(pattern.toLowerCase())
          }
        })
        if (!senderMatches) ruleMatches = false
      }

      // Check subject keywords
      if (conditions.subject_keywords && conditions.subject_keywords.length > 0) {
        const subjectMatches = conditions.subject_keywords.some((keyword: string) =>
          subject.toLowerCase().includes(keyword.toLowerCase())
        )
        if (!subjectMatches) ruleMatches = false
      }

      // Check body keywords
      if (conditions.body_keywords && conditions.body_keywords.length > 0) {
        const bodyMatches = conditions.body_keywords.some((keyword: string) =>
          bodyText.toLowerCase().includes(keyword.toLowerCase())
        )
        if (!bodyMatches) ruleMatches = false
      }

      // Apply rule actions if conditions match
      if (ruleMatches) {
        appliedRules.push({
          rule_id: rule.id,
          rule_name: rule.name,
          conditions_matched: conditions,
          actions_applied: actions
        })

        // Apply label assignments
        if (actions.assign_labels && actions.assign_labels.length > 0) {
          await addLabelsToEmail(client, emailId, actions.assign_labels, 'n8n_rule')
          assignedLabels.push(...actions.assign_labels)
        }

        // Update rule execution count
        await client.query(`
          UPDATE n8n_email_rules 
          SET execution_count = execution_count + 1, last_executed_at = NOW()
          WHERE id = $1
        `, [rule.id])
      }
    }

    // Also apply automatic label detection based on content analysis
    const contentLabels = await detectContentLabels(fromEmail, subject, bodyText)
    if (contentLabels.length > 0) {
      await addLabelsToEmail(client, emailId, contentLabels, 'content_analysis')
      assignedLabels.push(...contentLabels)
    }

  } catch (error) {
    console.error('Error applying email rules:', error)
  }

  return { applied_rules: appliedRules, assigned_labels: [...new Set(assignedLabels)] }
}

async function addLabelsToEmail(
  client: any,
  emailId: string,
  labelNames: string[],
  assignedBy: string
) {
  try {
    // Get label IDs from names
    const labelResult = await client.query(`
      SELECT id, name FROM email_labels 
      WHERE name = ANY($1) AND is_active = TRUE
    `, [labelNames])

    const labelMap = new Map(labelResult.rows.map((row: any) => [row.name, row.id]))

    // Insert associations
    for (const labelName of labelNames) {
      const labelId = labelMap.get(labelName)
      if (labelId) {
        await client.query(`
          INSERT INTO email_label_associations (email_id, label_id, assigned_by, confidence_score)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email_id, label_id) DO NOTHING
        `, [emailId, labelId, assignedBy, 0.85])
      }
    }
  } catch (error) {
    console.error('Error adding labels to email:', error)
  }
}

async function getSuggestedTemplates(client: any, emailId: string) {
  try {
    // Get suggested templates
    const suggestedResult = await client.query(`
      SELECT DISTINCT
        et.id as template_id,
        et.name as template_name,
        et.description,
        et.category,
        tla.priority_score,
        tla.auto_suggest,
        tla.auto_apply,
        el.name as label_name
      FROM email_label_associations ela
      JOIN email_labels el ON ela.label_id = el.id
      JOIN template_label_associations tla ON el.id = tla.label_id
      JOIN email_templates et ON tla.template_id = et.id
      WHERE ela.email_id = $1
        AND el.is_active = TRUE
        AND et.is_active = TRUE
      ORDER BY tla.priority_score DESC, et.usage_count DESC
      LIMIT 5
    `, [emailId])

    const suggested = suggestedResult.rows.filter((row: any) => row.auto_suggest)
    const autoApply = suggestedResult.rows.filter((row: any) => row.auto_apply)

    return {
      suggested_templates: suggested,
      auto_apply_templates: autoApply
    }
  } catch (error) {
    console.error('Error getting suggested templates:', error)
    return { suggested_templates: [], auto_apply_templates: [] }
  }
}

async function generateDraftFromTemplate(
  client: any,
  emailId: string,
  templateId: string,
  source: string
) {
  try {
    // Get template and email details
    const templateResult = await client.query(`
      SELECT * FROM email_templates WHERE id = $1
    `, [templateId])
    
    const emailResult = await client.query(`
      SELECT * FROM emails WHERE id = $1
    `, [emailId])

    if (templateResult.rows.length === 0 || emailResult.rows.length === 0) {
      return null
    }

    const template = templateResult.rows[0]
    const email = emailResult.rows[0]

    // Generate draft content (simplified version)
    let draftContent = template.body_template
    const variables = {
      'FROM_NAME': email.from_name || 'Sender',
      'SUBJECT': email.subject || '',
      'DATE': new Date().toLocaleDateString()
    }

    Object.entries(variables).forEach(([key, value]) => {
      draftContent = draftContent.replace(new RegExp(`\\[${key}\\]`, 'g'), value)
    })

    // Store draft (you might want to create a drafts table)
    const draftResult = await client.query(`
      INSERT INTO email_drafts (
        email_id, template_id, content, generated_by, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [emailId, templateId, draftContent, source])

    return {
      draft_id: draftResult.rows[0].id,
      template_id: templateId,
      content: draftContent,
      generated_by: source
    }
  } catch (error) {
    console.error('Error generating draft from template:', error)
    return null
  }
}

function detectContentLabels(fromEmail: string, subject: string, bodyText: string): string[] {
  const labels: string[] = []
  const content = `${subject} ${bodyText}`.toLowerCase()

  // Finance keywords
  if (/\b(invoice|payment|budget|financial|accounting|expense|cost)\b/.test(content)) {
    labels.push('Finance')
  }

  // Support keywords  
  if (/\b(help|support|issue|problem|question|assistance)\b/.test(content)) {
    labels.push('Customer Support')
  }

  // HR keywords
  if (/\b(interview|hiring|employee|hr|human resources|benefits)\b/.test(content)) {
    labels.push('HR')
  }

  // Legal keywords
  if (/\b(contract|legal|compliance|agreement|terms)\b/.test(content)) {
    labels.push('Legal')
  }

  // Marketing keywords
  if (/\b(campaign|marketing|promotion|advertisement|social media)\b/.test(content)) {
    labels.push('Marketing')
  }

  return labels
}