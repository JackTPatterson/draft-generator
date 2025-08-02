import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import pool from '@/lib/database'
import { DocumentProcessor, AIDocumentProcessor } from '@/lib/document-processor'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'demo-user'
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const status = searchParams.get('status')

  try {
    const client = await pool.connect()
    
    let query = `
      SELECT 
        id,
        title,
        description,
        filename,
        original_filename,
        file_type,
        file_size,
        status,
        category,
        tags,
        key_topics,
        usage_count,
        word_count,
        page_count,
        created_at,
        updated_at,
        processed_at
      FROM knowledge_documents 
      WHERE user_id = $1 AND is_active = true
    `
    
    const params = [userId]
    let paramIndex = 2

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (status) {
      query += ` AND status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR $${paramIndex} = ANY(tags))`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC`

    const result = await client.query(query, params)
    client.release()

    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('Error fetching knowledge documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const category = formData.get('category') as string
    const tags = formData.get('tags') as string
    const userId = formData.get('userId') as string || 'demo-user'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, DOCX, TXT, MD, HTML, XLSX, or CSV files.' 
      }, { status: 400 })
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB.' 
      }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save file and get metadata
    const uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge')
    const { filePath, filename, fileHash } = await DocumentProcessor.saveUploadedFile(
      buffer, 
      file.name, 
      uploadsDir
    )

    // Determine file type enum value
    const fileExtension = path.extname(file.name).toLowerCase()
    let fileType = 'txt'
    switch (fileExtension) {
      case '.pdf': fileType = 'pdf'; break
      case '.docx': fileType = 'docx'; break
      case '.md': fileType = 'md'; break
      case '.html': fileType = 'html'; break
      case '.xlsx': fileType = 'xlsx'; break
      case '.csv': fileType = 'csv'; break
      default: fileType = 'txt'
    }

    // Insert document record
    const client = await pool.connect()
    
    const insertResult = await client.query(`
      INSERT INTO knowledge_documents (
        user_id, filename, original_filename, file_type, file_size, 
        mime_type, file_path, file_hash, title, description, category, 
        tags, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'processing')
      RETURNING id
    `, [
      userId, filename, file.name, fileType, file.size,
      file.type, filePath, fileHash, title || file.name, description,
      category, tags ? tags.split(',').map(t => t.trim()) : []
    ])

    const documentId = insertResult.rows[0].id
    client.release()

    // Process document asynchronously
    processDocumentAsync(documentId, filePath, file.name, file.type, category)
      .catch(error => console.error('Async document processing failed:', error))

    return NextResponse.json({ 
      message: 'Document uploaded successfully. Processing in background.',
      documentId,
      status: 'processing'
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}

// Async function to process document in background
async function processDocumentAsync(
  documentId: string, 
  filePath: string, 
  fileName: string, 
  mimeType: string,
  category?: string
) {
  const client = await pool.connect()
  
  try {
    // Process document
    const processed = await DocumentProcessor.processDocument(filePath, fileName, mimeType)
    
    // Generate embeddings for the document
    const documentTitle = fileName.replace(/\.[^/.]+$/, "") // Remove extension
    const processedWithEmbeddings = await DocumentProcessor.generateEmbeddings(
      processed,
      documentTitle,
      category
    )
    
    // Enhance with AI if needed
    const aiEnhanced = await AIDocumentProcessor.enhanceWithAI(processedWithEmbeddings, category)
    
    // Sanitize all text data before database insertion
    const sanitizeText = (text: string) => text ? text.replace(/\0/g, '').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '') : ''
    
    // Update document with processed content and embeddings
    await client.query(`
      UPDATE knowledge_documents SET
        status = 'processed',
        extracted_text = $2,
        page_count = $3,
        word_count = $4,
        summary = $5,
        key_topics = $6,
        business_context = $7,
        title_embedding = $8,
        content_embedding = $9,
        combined_embedding = $10,
        processed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [
      documentId,
      sanitizeText(processedWithEmbeddings.extractedText),
      processedWithEmbeddings.pageCount,
      processedWithEmbeddings.wordCount,
      sanitizeText(aiEnhanced.enhancedSummary || ''),
      processedWithEmbeddings.keyTopics?.map(topic => sanitizeText(topic)) || [],
      JSON.stringify(aiEnhanced.businessContext),
      processedWithEmbeddings.embeddings?.titleEmbedding ? JSON.stringify(processedWithEmbeddings.embeddings.titleEmbedding) : null,
      processedWithEmbeddings.embeddings?.contentEmbedding ? JSON.stringify(processedWithEmbeddings.embeddings.contentEmbedding) : null,
      processedWithEmbeddings.embeddings?.combinedEmbedding ? JSON.stringify(processedWithEmbeddings.embeddings.combinedEmbedding) : null
    ])

    // Insert chunks with embeddings
    for (const chunk of processedWithEmbeddings.chunks) {
      await client.query(`
        INSERT INTO knowledge_chunks (
          document_id, user_id, chunk_text, chunk_index, 
          section_title, chunk_type, context_before, context_after, chunk_embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        documentId,
        'demo-user', // TODO: Get from document
        sanitizeText(chunk.text),
        chunk.index,
        sanitizeText(chunk.sectionTitle || ''),
        chunk.chunkType,
        sanitizeText(chunk.contextBefore || ''),
        sanitizeText(chunk.contextAfter || ''),
        chunk.embedding ? JSON.stringify(chunk.embedding) : null
      ])
    }

    console.log(`Document ${documentId} processed successfully`)

  } catch (error: any) {
    console.error(`Error processing document ${documentId}:`, error)
    
    // Update status to failed
    await client.query(`
      UPDATE knowledge_documents SET
        status = 'failed',
        processing_error = $2,
        updated_at = NOW()
      WHERE id = $1
    `, [documentId, error.message])
    
  } finally {
    client.release()
  }
}