import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { email_id: string } }
) {
  try {
    const emailId = params.email_id

    const client = await pool.connect()
    
    try {
      // Get all labels associated with this email
      const result = await client.query(`
        SELECT 
          el.*,
          ela.assigned_by,
          ela.assigned_at,
          ela.confidence_score
        FROM email_label_associations ela
        JOIN email_labels el ON ela.label_id = el.id
        WHERE ela.email_id = $1
        ORDER BY el.sort_order, el.name
      `, [emailId])

      return NextResponse.json({
        success: true,
        email_id: emailId,
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

export async function POST(
  request: NextRequest,
  { params }: { params: { email_id: string } }
) {
  try {
    const emailId = params.email_id
    const body = await request.json()
    const {
      labelIds = [],
      labelNames = [],
      assigned_by = 'manual',
      confidence_score
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

      // Insert label associations (ignore duplicates)
      const insertPromises = allLabelIds.map(labelId =>
        client.query(`
          INSERT INTO email_label_associations (email_id, label_id, assigned_by, confidence_score)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email_id, label_id) DO NOTHING
          RETURNING *
        `, [emailId, labelId, assigned_by, confidence_score])
      )

      const results = await Promise.all(insertPromises)
      const addedAssociations = results.filter(result => result.rows.length > 0)

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        email_id: emailId,
        added_associations: addedAssociations.length,
        total_requested: allLabelIds.length
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error adding email labels:', error)
    return NextResponse.json(
      { error: 'Failed to add email labels' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { email_id: string } }
) {
  try {
    const emailId = params.email_id
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
          DELETE FROM email_label_associations 
          WHERE email_id = $1 AND label_id = $2
        `
        queryParams = [emailId, labelId]
      } else {
        deleteQuery = `
          DELETE FROM email_label_associations 
          WHERE email_id = $1 AND label_id = (
            SELECT id FROM email_labels WHERE name = $2 LIMIT 1
          )
        `
        queryParams = [emailId, labelName]
      }

      const result = await client.query(deleteQuery, queryParams)

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'Label association not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        email_id: emailId,
        removed_associations: result.rowCount
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error removing email label:', error)
    return NextResponse.json(
      { error: 'Failed to remove email label' },
      { status: 500 }
    )
  }
}