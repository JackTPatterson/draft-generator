import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id

    const client = await pool.connect()
    
    try {
      // Get all labels associated with this template
      const result = await client.query(`
        SELECT 
          el.*,
          tla.priority_score,
          tla.auto_suggest,
          tla.auto_apply,
          tla.sender_conditions,
          tla.subject_conditions,
          tla.content_conditions,
          tla.created_at as association_created_at
        FROM template_label_associations tla
        JOIN email_labels el ON tla.label_id = el.id
        WHERE tla.template_id = $1
        ORDER BY tla.priority_score DESC, el.name
      `, [templateId])

      return NextResponse.json({
        success: true,
        template_id: templateId,
        label_associations: result.rows
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error fetching template label associations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template label associations' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id
    const body = await request.json()
    const {
      labelIds = [],
      labelNames = [],
      priority_score = 1,
      auto_suggest = true,
      auto_apply = false,
      sender_conditions,
      subject_conditions,
      content_conditions
    } = body

    if (labelIds.length === 0 && labelNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one label ID or name must be provided' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      // Resolve label names to IDs if needed
      let allLabelIds = [...labelIds]
      
      if (labelNames.length > 0) {
        const labelNameResult = await client.query(`
          SELECT id FROM email_labels 
          WHERE name = ANY($1) AND is_active = TRUE
        `, [labelNames])
        
        const resolvedIds = labelNameResult.rows.map(row => row.id)
        allLabelIds = [...allLabelIds, ...resolvedIds]
      }

      // Remove duplicates
      allLabelIds = [...new Set(allLabelIds)]

      if (allLabelIds.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'No valid labels found' },
          { status: 400 }
        )
      }

      // Insert template-label associations (ignore duplicates, update if exists)
      const insertPromises = allLabelIds.map(labelId =>
        client.query(`
          INSERT INTO template_label_associations (
            template_id, label_id, priority_score, auto_suggest, auto_apply,
            sender_conditions, subject_conditions, content_conditions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (template_id, label_id) 
          DO UPDATE SET
            priority_score = EXCLUDED.priority_score,
            auto_suggest = EXCLUDED.auto_suggest,
            auto_apply = EXCLUDED.auto_apply,
            sender_conditions = EXCLUDED.sender_conditions,
            subject_conditions = EXCLUDED.subject_conditions,
            content_conditions = EXCLUDED.content_conditions,
            updated_at = NOW()
          RETURNING *
        `, [
          templateId, labelId, priority_score, auto_suggest, auto_apply,
          sender_conditions, subject_conditions, content_conditions
        ])
      )

      const results = await Promise.all(insertPromises)
      const processedAssociations = results.map(result => result.rows[0])

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        template_id: templateId,
        associations: processedAssociations
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error adding template label associations:', error)
    return NextResponse.json(
      { error: 'Failed to add template label associations' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id
    const body = await request.json()
    const {
      labelId,
      labelName,
      priority_score,
      auto_suggest,
      auto_apply,
      sender_conditions,
      subject_conditions,
      content_conditions
    } = body

    if (!labelId && !labelName) {
      return NextResponse.json(
        { error: 'Either labelId or labelName must be provided' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Build dynamic update query
      const updateFields: string[] = []
      const queryParams: any[] = [templateId]
      let paramCount = 2

      if (priority_score !== undefined) {
        updateFields.push(`priority_score = $${paramCount}`)
        queryParams.push(priority_score)
        paramCount++
      }

      if (auto_suggest !== undefined) {
        updateFields.push(`auto_suggest = $${paramCount}`)
        queryParams.push(auto_suggest)
        paramCount++
      }

      if (auto_apply !== undefined) {
        updateFields.push(`auto_apply = $${paramCount}`)
        queryParams.push(auto_apply)
        paramCount++
      }

      if (sender_conditions !== undefined) {
        updateFields.push(`sender_conditions = $${paramCount}`)
        queryParams.push(sender_conditions)
        paramCount++
      }

      if (subject_conditions !== undefined) {
        updateFields.push(`subject_conditions = $${paramCount}`)
        queryParams.push(subject_conditions)
        paramCount++
      }

      if (content_conditions !== undefined) {
        updateFields.push(`content_conditions = $${paramCount}`)
        queryParams.push(content_conditions)
        paramCount++
      }

      if (updateFields.length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        )
      }

      let whereClause: string
      if (labelId) {
        whereClause = `template_id = $1 AND label_id = $${paramCount}`
        queryParams.push(labelId)
      } else {
        whereClause = `template_id = $1 AND label_id = (SELECT id FROM email_labels WHERE name = $${paramCount} LIMIT 1)`
        queryParams.push(labelName)
      }

      const updateQuery = `
        UPDATE template_label_associations 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE ${whereClause}
        RETURNING *
      `

      const result = await client.query(updateQuery, queryParams)

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Template-label association not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        association: result.rows[0]
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error updating template label association:', error)
    return NextResponse.json(
      { error: 'Failed to update template label association' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('labelId')
    const labelName = searchParams.get('labelName')

    if (!labelId && !labelName) {
      return NextResponse.json(
        { error: 'Either labelId or labelName must be provided' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      let deleteQuery: string
      let queryParams: any[]

      if (labelId) {
        deleteQuery = `
          DELETE FROM template_label_associations 
          WHERE template_id = $1 AND label_id = $2
        `
        queryParams = [templateId, labelId]
      } else {
        deleteQuery = `
          DELETE FROM template_label_associations 
          WHERE template_id = $1 AND label_id = (
            SELECT id FROM email_labels WHERE name = $2 LIMIT 1
          )
        `
        queryParams = [templateId, labelName]
      }

      const result = await client.query(deleteQuery, queryParams)

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'Template-label association not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        template_id: templateId,
        removed_associations: result.rowCount
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error removing template label association:', error)
    return NextResponse.json(
      { error: 'Failed to remove template label association' },
      { status: 500 }
    )
  }
}