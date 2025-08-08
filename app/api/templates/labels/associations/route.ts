import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('labelId')
    const templateId = searchParams.get('templateId')
    const userId = searchParams.get('userId') || 'bab71c40-6151-424a-ba8c-c17f035c6e19'

    const client = await pool.connect()
    
    try {
      let query = `
        SELECT 
          tla.*,
          et.name as template_name,
          et.category as template_category,
          et.description as template_description,
          el.name as label_name,
          el.type as label_type,
          el.color as label_color
--           el.email_count,
--           el.template_count
        FROM template_label_associations tla
        JOIN email_templates et ON tla.template_id = et.id
        JOIN email_labels el ON tla.label_id = el.id
        WHERE el.user_id::text = $1
      `
      const queryParams: any[] = [userId]

      if (labelId) {
        query += ` AND tla.label_id = $${queryParams.length + 1}`
        queryParams.push(labelId)
      }

      if (templateId) {
        query += ` AND tla.template_id = $${queryParams.length + 1}`
        queryParams.push(templateId)
      }

      query += ` ORDER BY tla.priority_score DESC, et.name`

      const result = await client.query(query, queryParams)

      // Format the results to include nested objects
      const associations = result.rows.map(row => ({
        id: row.id,
        template_id: row.template_id,
        label_id: row.label_id,
        priority_score: row.priority_score,
        auto_suggest: row.auto_suggest,
        auto_apply: row.auto_apply,
        created_at: row.created_at,
        updated_at: row.updated_at,
        template: {
          id: row.template_id,
          name: row.template_name,
          category: row.template_category,
          description: row.template_description
        },
        label: {
          id: row.label_id,
          name: row.label_name,
          type: row.label_type,
          color: row.label_color,
          email_count: row.email_count,
          template_count: row.template_count
        }
      }))

      return NextResponse.json({
        success: true,
        associations
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error fetching template-label associations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch associations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { associations } = body

    if (!associations || !Array.isArray(associations) || associations.length === 0) {
      return NextResponse.json(
        { error: 'Associations array is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      const createdAssociations = []

      for (const association of associations) {
        const {
          template_id,
          label_id,
          priority_score = 1,
          auto_suggest = true,
          auto_apply = false
        } = association

        if (!template_id || !label_id) {
          throw new Error('Both template_id and label_id are required for each association')
        }

        // Check if association already exists
        const existingAssociation = await client.query(
          'SELECT id FROM template_label_associations WHERE template_id = $1 AND label_id = $2',
          [template_id, label_id]
        )

        if (existingAssociation.rows.length > 0) {
          continue // Skip if association already exists
        }

        // Create new association
        const result = await client.query(`
          INSERT INTO template_label_associations (
            template_id, label_id, priority_score, auto_suggest, auto_apply
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [template_id, label_id, priority_score, auto_suggest, auto_apply])

        createdAssociations.push(result.rows[0])
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        associations: createdAssociations,
        message: `Created ${createdAssociations.length} associations`
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error creating template-label associations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create associations' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      priority_score,
      auto_suggest,
      auto_apply
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Association ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Build dynamic update query
      const updateFields: string[] = []
      const queryParams: any[] = []
      let paramCount = 1

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

      if (updateFields.length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        )
      }

      queryParams.push(id)
      const updateQuery = `
        UPDATE template_label_associations 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await client.query(updateQuery, queryParams)

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Association not found' },
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
    console.error('Error updating template-label association:', error)
    return NextResponse.json(
      { error: 'Failed to update association' },
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
        { error: 'Association ID is required' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    
    try {
      // Check if association exists
      const existingAssociation = await client.query(
        'SELECT id FROM template_label_associations WHERE id = $1',
        [id]
      )

      if (existingAssociation.rows.length === 0) {
        return NextResponse.json(
          { error: 'Association not found' },
          { status: 404 }
        )
      }

      // Delete the association
      await client.query('DELETE FROM template_label_associations WHERE id = $1', [id])

      return NextResponse.json({
        success: true,
        message: 'Association deleted successfully'
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error deleting template-label association:', error)
    return NextResponse.json(
      { error: 'Failed to delete association' },
      { status: 500 }
    )
  }
}