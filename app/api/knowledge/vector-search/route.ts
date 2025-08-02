import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { createEmbeddingService } from '@/lib/embedding-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()



    const { 
      userId = 'demo-user',
      query,
      category,
      limit = 10,
      searchType = 'hybrid', // 'vector', 'text', 'hybrid'
      similarityThreshold = 0.7,
      vectorWeight = 0.7,
      textWeight = 0.3
    } = body

    if (!query) {
      return NextResponse.json({ 
        error: 'Query is required' 
      }, { status: 400 })
    }

    const client = await pool.connect()
    let results = []

    try {
      if (searchType === 'vector' || searchType === 'hybrid') {
        // Generate query embedding
        const embeddingService = createEmbeddingService()
        const queryEmbedding = await embeddingService.generateEmbedding(query)
        
        if (searchType === 'vector') {
          // Pure vector search
          const vectorResults = await client.query(`
            SELECT * FROM find_similar_documents_json($1, $2, $3, $4, $5)
          `, [
            userId, 
            JSON.stringify(queryEmbedding.embedding), 
            category, 
            limit, 
            similarityThreshold
          ])
          
          results = vectorResults.rows.map(row => ({
            ...row,
            searchType: 'vector'
          }))
        } else {
          // Hybrid search
          const hybridResults = await client.query(`
            SELECT * FROM hybrid_search_knowledge_json($1, $2, $3, $4, $5, $6, $7)
          `, [
            userId,
            query,
            JSON.stringify(queryEmbedding.embedding),
            category,
            limit,
            vectorWeight,
            textWeight
          ])
          
          results = hybridResults.rows.map(row => ({
            ...row,
            searchType: 'hybrid'
          }))
        }
      } else {
        // Pure text search (fallback)
        const textResults = await client.query(`
          SELECT * FROM search_knowledge_base($1, $2, $3, $4)
        `, [userId, query, category, limit])
        
        results = textResults.rows.map(row => ({
          ...row,
          vector_score: 0,
          text_score: row.relevance_score || 0,
          combined_score: row.relevance_score || 0,
          searchType: 'text'
        }))
      }

      // Also get relevant chunks if vector search is enabled
      let chunks = []
      if ((searchType === 'vector' || searchType === 'hybrid') && results.length > 0) {
        try {
          const embeddingService = createEmbeddingService()
          const queryEmbedding = await embeddingService.generateEmbedding(query)
          
          const chunkResults = await client.query(`
            SELECT * FROM find_similar_chunks_json($1, $2, $3, $4)
          `, [
            userId,
            JSON.stringify(queryEmbedding.embedding),
            Math.min(limit, 8), // Limit chunks
            similarityThreshold * 0.8 // Lower threshold for chunks
          ])
          
          chunks = chunkResults.rows
        } catch (chunkError) {
          console.warn('Failed to get similar chunks:', chunkError)
        }
      }

      client.release()

      return NextResponse.json({
        query,
        searchType,
        results: results.map(result => ({
          id: result.id,
          title: result.title,
          description: result.description,
          category: result.category,
          snippet: result.snippet,
          similarity_score: result.similarity_score || result.vector_score || result.relevance_score || 0,
          vector_score: result.vector_score || 0,
          text_score: result.text_score || result.relevance_score || 0,
          combined_score: result.combined_score || result.similarity_score || result.relevance_score || 0
        })),
        chunks: chunks.map(chunk => ({
          text: chunk.chunk_text,
          document_title: chunk.document_title,
          section_title: chunk.section_title,
          similarity_score: chunk.similarity_score,
          document_id: chunk.document_id
        })),
        metadata: {
          total_results: results.length,
          total_chunks: chunks.length,
          search_params: {
            similarity_threshold: similarityThreshold,
            vector_weight: vectorWeight,
            text_weight: textWeight
          }
        }
      })

    } catch (searchError) {
      console.error('Search error:', searchError)
      client.release()
      
      // Fallback to text search if vector search fails
      if (searchType !== 'text') {
        console.log('Falling back to text search...')
        const textResults = await pool.query(`
          SELECT * FROM search_knowledge_base($1, $2, $3, $4)
        `, [userId, query, category, limit])
        
        return NextResponse.json({
          query,
          searchType: 'text_fallback',
          results: textResults.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            category: row.category,
            snippet: row.snippet,
            similarity_score: row.relevance_score || 0,
            vector_score: 0,
            text_score: row.relevance_score || 0,
            combined_score: row.relevance_score || 0
          })),
          chunks: [],
          metadata: {
            total_results: textResults.rows.length,
            fallback_reason: 'Vector search failed, used text search'
          }
        })
      }
      
      throw searchError
    }

  } catch (error: any) {
    console.error('Vector search API error:', error)
    return NextResponse.json({ 
      error: 'Failed to perform vector search',
      details: error?.message
    }, { status: 500 })
  }
}