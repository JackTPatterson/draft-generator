import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email_id,
      gmail_id,
      detected_labels = [],
      primary_label,
      confidence_scores = [],
      user_id = 'bab71c40-6151-424a-ba8c-c17f035c6e19',
      assigned_by = 'n8n'
    } = body

    if (!gmail_id) {
      return NextResponse.json(
        { error: 'Gmail ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // First, ensure the email exists in our emails table
      let emailDbId = null
      
      // Always search by gmail_message_id since it's more reliable than email_id
      const existingEmail = await client.query(
        'SELECT id FROM emails WHERE gmail_message_id = $1 AND user_id = $2',
        [gmail_id, user_id]
      )

      if (existingEmail.rows.length > 0) {
        emailDbId = existingEmail.rows[0].id
      } else {
        // Create email record if it doesn't exist
        const emailInsert = await client.query(`
          INSERT INTO emails (
            user_id, gmail_message_id, gmail_thread_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, 'inbox', NOW(), NOW())
          RETURNING id
        `, [user_id, gmail_id, gmail_id]) // Using gmail_id as thread_id fallback

        emailDbId = emailInsert.rows[0].id
      }

      const assignedLabels = []
      const failedAssignments = []

      // Process each detected label
      for (const detectedLabel of detected_labels) {
        try {
          // Find the label in our database
          const labelQuery = await client.query(
            'SELECT id FROM email_labels WHERE name = $1 AND user_id = $2',
            [detectedLabel.name, user_id]
          )

          if (labelQuery.rows.length === 0) {
            failedAssignments.push({
              label_name: detectedLabel.name,
              reason: 'Label not found in database'
            })
            continue
          }

          const labelId = labelQuery.rows[0].id

          // Check if association already exists
          const existingAssociation = await client.query(
            'SELECT id FROM email_label_associations WHERE email_id = $1 AND label_id = $2',
            [emailDbId, labelId]
          )

          if (existingAssociation.rows.length > 0) {
            // Update existing association
            await client.query(`
              UPDATE email_label_associations 
              SET confidence_score = $1, assigned_by = $2, assigned_at = NOW()
              WHERE email_id = $3 AND label_id = $4
            `, [
              detectedLabel.confidence || 0.8,
              assigned_by,
              emailDbId,
              labelId
            ])

            assignedLabels.push({
              label_id: labelId,
              label_name: detectedLabel.name,
              confidence: detectedLabel.confidence || 0.8,
              action: 'updated'
            })
          } else {
            // Create new association
            const associationResult = await client.query(`
              INSERT INTO email_label_associations (
                email_id, label_id, assigned_by, assigned_at, confidence_score
              ) VALUES ($1, $2, $3, NOW(), $4)
              RETURNING id
            `, [
              emailDbId,
              labelId,
              assigned_by,
              detectedLabel.confidence || 0.8
            ])

            assignedLabels.push({
              association_id: associationResult.rows[0].id,
              label_id: labelId,
              label_name: detectedLabel.name,
              confidence: detectedLabel.confidence || 0.8,
              action: 'created'
            })
          }

        } catch (labelError) {
          console.error(`Error assigning label ${detectedLabel.name}:`, labelError)
          failedAssignments.push({
            label_name: detectedLabel.name,
            reason: labelError.message
          })
        }
      }

      // Update email with classification info using webhook_data column
      if (primary_label && emailDbId) {
        await client.query(`
          UPDATE emails 
          SET 
            webhook_data = COALESCE(webhook_data, '{}')::jsonb || $1::jsonb,
            updated_at = NOW()
          WHERE id = $2
        `, [
          JSON.stringify({
            primary_label: primary_label,
            auto_classified: true,
            classification_method: assigned_by,
            classification_timestamp: new Date().toISOString(),
            total_labels_detected: detected_labels.length,
            detected_labels: detected_labels.map(l => ({ name: l.name, confidence: l.confidence }))
          }),
          emailDbId
        ])
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        email_id: emailDbId,
        gmail_id: gmail_id,
        assigned_labels: assignedLabels,
        failed_assignments: failedAssignments,
        primary_label: primary_label,
        summary: {
          total_labels_processed: detected_labels.length,
          successful_assignments: assignedLabels.length,
          failed_assignments: failedAssignments.length,
          assigned_by: assigned_by
        }
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error assigning labels to email:', error)
    return NextResponse.json(
      { error: 'Failed to assign labels to email' },
      { status: 500 }
    )
  }
}