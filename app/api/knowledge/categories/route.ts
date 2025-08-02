import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'demo-user'

  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT 
        bkc.*,
        COUNT(kd.id) as document_count
      FROM business_knowledge_categories bkc
      LEFT JOIN knowledge_documents kd ON kd.category = bkc.name AND kd.user_id = bkc.user_id AND kd.is_active = true
      WHERE bkc.user_id = $1 AND bkc.is_active = true
      GROUP BY bkc.id
      ORDER BY bkc.sort_order, bkc.name
    `, [userId])

    client.release()

    return NextResponse.json({ categories: result.rows })
  } catch (error) {
    console.error('Error fetching knowledge categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      icon = 'folder',
      color = '#6B7280',
      ai_prompt_template,
      extraction_rules,
      sort_order = 0,
      userId = 'demo-user'
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const client = await pool.connect()
    
    const result = await client.query(`
      INSERT INTO business_knowledge_categories (
        user_id, name, description, icon, color, 
        ai_prompt_template, extraction_rules, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId, name, description, icon, color,
      ai_prompt_template, JSON.stringify(extraction_rules || {}), sort_order
    ])

    client.release()

    return NextResponse.json({ category: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating knowledge category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}