import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT 
        kd.*,
        -- Get chunks for this document
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', kc.id,
              'chunk_text', kc.chunk_text,
              'chunk_index', kc.chunk_index,
              'section_title', kc.section_title,
              'chunk_type', kc.chunk_type
            ) ORDER BY kc.chunk_index
          ) FILTER (WHERE kc.id IS NOT NULL),
          '[]'::json
        ) as chunks
      FROM knowledge_documents kd
      LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
      WHERE kd.id = $1
      GROUP BY kd.id
    `, [params.id])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      category,
      tags,
      is_searchable
    } = body

    const client = await pool.connect()
    
    const result = await client.query(`
      UPDATE knowledge_documents SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        tags = COALESCE($5, tags),
        is_searchable = COALESCE($6, is_searchable),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      params.id, title, description, category, tags, is_searchable
    ])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await pool.connect()
    
    // Soft delete - mark as inactive
    const result = await client.query(`
      UPDATE knowledge_documents SET
        is_active = false,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [params.id])

    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}