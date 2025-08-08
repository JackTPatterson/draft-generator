import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // Filter by label type
    const includeSystemLabels = searchParams.get('includeSystem') !== 'false'

    const client = await pool.connect()
    
    try {
      let query = `
        SELECT 
          el.*,
          COUNT(ela.email_id) as email_count,
          COUNT(tla.template_id) as template_count
        FROM email_labels el
        LEFT JOIN email_label_associations ela ON el.id = ela.label_id
        LEFT JOIN template_label_associations tla ON el.id = tla.label_id
        WHERE el.user_id = $1
      `
      const queryParams: any[] = [userId]

      if (type) {
        query += ` AND el.type = $${queryParams.length + 1}`
        queryParams.push(type)
      }

      if (!includeSystemLabels) {
        query += ` AND el.is_system = FALSE`
      }

      query += `
        GROUP BY el.id, el.user_id, el.name, el.description, el.type, el.color, 
                 el.icon, el.n8n_trigger_keywords, el.n8n_sender_patterns, 
                 el.n8n_subject_patterns, el.sort_order, el.is_active, 
                 el.is_system, el.created_at, el.updated_at
        ORDER BY el.sort_order, el.name
      `

      const result = await client.query(query, queryParams)

      return NextResponse.json({
        success: true,
        labels: result.rows
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error fetching email labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email labels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const body = await request.json()
    const {
      name,
      description,
      type = 'custom',
      color = '#6B7280',
      icon,
      n8n_trigger_keywords = [],
      n8n_sender_patterns = [],
      n8n_subject_patterns = [],
      sort_order = 0
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Label name is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Check if label name already exists for this user
      const existingLabel = await client.query(
        'SELECT id FROM email_labels WHERE user_id = $1 AND name = $2',
        [userId, name]
      )

      if (existingLabel.rows.length > 0) {
        return NextResponse.json(
          { error: 'A label with this name already exists' },
          { status: 409 }
        )
      }

      // Create new label
      const result = await client.query(`
        INSERT INTO email_labels (
          user_id, name, description, type, color, icon,
          n8n_trigger_keywords, n8n_sender_patterns, n8n_subject_patterns,
          sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        userId, name, description, type, color, icon,
        n8n_trigger_keywords, n8n_sender_patterns, n8n_subject_patterns,
        sort_order
      ])

      return NextResponse.json({
        success: true,
        label: result.rows[0]
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error creating email label:', error)
    return NextResponse.json(
      { error: 'Failed to create email label' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      description,
      type,
      color,
      icon,
      n8n_trigger_keywords,
      n8n_sender_patterns,
      n8n_subject_patterns,
      sort_order,
      is_active
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Label ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Check if label exists and is not a system label (system labels have restrictions)
      const existingLabel = await client.query(
        'SELECT is_system FROM email_labels WHERE id = $1',
        [id]
      )

      if (existingLabel.rows.length === 0) {
        return NextResponse.json(
          { error: 'Label not found' },
          { status: 404 }
        )
      }

      const isSystemLabel = existingLabel.rows[0].is_system

      // Build dynamic update query
      const updateFields: string[] = []
      const queryParams: any[] = []
      let paramCount = 1

      if (name !== undefined && (!isSystemLabel || name === existingLabel.rows[0].name)) {
        updateFields.push(`name = $${paramCount}`)
        queryParams.push(name)
        paramCount++
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramCount}`)
        queryParams.push(description)
        paramCount++
      }

      if (type !== undefined && !isSystemLabel) {
        updateFields.push(`type = $${paramCount}`)
        queryParams.push(type)
        paramCount++
      }

      if (color !== undefined) {
        updateFields.push(`color = $${paramCount}`)
        queryParams.push(color)
        paramCount++
      }

      if (icon !== undefined) {
        updateFields.push(`icon = $${paramCount}`)
        queryParams.push(icon)
        paramCount++
      }

      if (n8n_trigger_keywords !== undefined) {
        updateFields.push(`n8n_trigger_keywords = $${paramCount}`)
        queryParams.push(n8n_trigger_keywords)
        paramCount++
      }

      if (n8n_sender_patterns !== undefined) {
        updateFields.push(`n8n_sender_patterns = $${paramCount}`)
        queryParams.push(n8n_sender_patterns)
        paramCount++
      }

      if (n8n_subject_patterns !== undefined) {
        updateFields.push(`n8n_subject_patterns = $${paramCount}`)
        queryParams.push(n8n_subject_patterns)
        paramCount++
      }

      if (sort_order !== undefined) {
        updateFields.push(`sort_order = $${paramCount}`)
        queryParams.push(sort_order)
        paramCount++
      }

      if (is_active !== undefined && !isSystemLabel) {
        updateFields.push(`is_active = $${paramCount}`)
        queryParams.push(is_active)
        paramCount++
      }

      if (updateFields.length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        )
      }

      queryParams.push(id)
      const updateQuery = `
        UPDATE email_labels 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await client.query(updateQuery, queryParams)

      return NextResponse.json({
        success: true,
        label: result.rows[0]
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error updating email label:', error)
    return NextResponse.json(
      { error: 'Failed to update email label' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Label ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Check if label exists and is not a system label
      const existingLabel = await client.query(
        'SELECT is_system FROM email_labels WHERE id = $1',
        [id]
      )

      if (existingLabel.rows.length === 0) {
        return NextResponse.json(
          { error: 'Label not found' },
          { status: 404 }
        )
      }

      if (existingLabel.rows[0].is_system) {
        return NextResponse.json(
          { error: 'Cannot delete system labels' },
          { status: 403 }
        )
      }

      // Delete the label (cascading deletes will handle associations)
      await client.query('DELETE FROM email_labels WHERE id = $1', [id])

      return NextResponse.json({
        success: true,
        message: 'Label deleted successfully'
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error deleting email label:', error)
    return NextResponse.json(
      { error: 'Failed to delete email label' },
      { status: 500 }
    )
  }
}