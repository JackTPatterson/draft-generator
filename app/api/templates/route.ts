import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'demo-user' // TODO: Get from auth
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  try {
    const client = await pool.connect()
    
    let query = `
      SELECT 
        id,
        name,
        description,
        category,
        type,
        tone,
        subject_template,
        body_template,
        ai_instructions,
        variables,
        tags,
        created_at,
        updated_at
      FROM email_templates 
      WHERE user_id = $1
    `
    
    const params = [userId]
    let paramIndex = 2

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC`

    const result = await client.query(query, params)
    client.release()

    return NextResponse.json({ templates: result.rows })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      category,
      type = 'reply',
      tone = 'professional',
      subject_template,
      body_template,
      ai_instructions,
      variables = [],
      tags = [],
      userId = 'demo-user' // TODO: Get from auth
    } = body

    if (!name || !body_template) {
      return NextResponse.json({ error: 'Name and body template are required' }, { status: 400 })
    }

    const client = await pool.connect()
    
    const result = await client.query(`
      INSERT INTO email_templates (
        user_id, name, description, category, type, tone,
        subject_template, body_template, ai_instructions,
        variables, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userId, name, description, category, type, tone,
      subject_template, body_template, ai_instructions,
      JSON.stringify(variables), tags
    ])

    client.release()

    return NextResponse.json({ template: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}