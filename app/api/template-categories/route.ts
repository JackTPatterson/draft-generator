import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId(request)
  
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT * FROM template_categories 
      WHERE user_id = $1 AND is_active = true
      ORDER BY sort_order, name
    `, [userId])

    client.release()

    return NextResponse.json({ categories: result.rows })
  } catch (error) {
    console.error('Error fetching template categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
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
      color = '#6B7280',
      icon = 'folder',
      sort_order = 0
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const client = await pool.connect()
    
    const result = await client.query(`
      INSERT INTO template_categories (
        user_id, name, description, color, icon, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, name, description, color, icon, sort_order])

    client.release()

    return NextResponse.json({ category: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating template category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}