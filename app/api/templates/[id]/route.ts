import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT * FROM email_templates WHERE id = $1
    `, [params.id])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template: result.rows[0] })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      category,
      type,
      tone,
      subject_template,
      body_template,
      ai_instructions,
      variables,
      tags
    } = body

    const client = await pool.connect()
    
    const result = await client.query(`
      UPDATE email_templates SET
        name = $2,
        description = $3,
        category = $4,
        type = $5,
        tone = $6,
        subject_template = $7,
        body_template = $8,
        ai_instructions = $9,
        variables = $10,
        tags = $11,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      params.id, name, description, category, type, tone,
      subject_template, body_template, ai_instructions,
      JSON.stringify(variables), tags
    ])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template: result.rows[0] })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      DELETE FROM email_templates WHERE id = $1 RETURNING id
    `, [params.id])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}