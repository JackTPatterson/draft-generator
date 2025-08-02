import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'demo-user'
  const query = searchParams.get('query')
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const client = await pool.connect()
    
    // Search using the database function
    const result = await client.query(`
      SELECT * FROM search_knowledge_base($1, $2, $3, $4)
    `, [userId, query, category, limit])

    // Also get relevant chunks
    const chunksResult = await client.query(`
      SELECT * FROM get_relevant_chunks($1, $2, $3)
    `, [userId, query, Math.min(limit, 5)])

    client.release()

    return NextResponse.json({ 
      documents: result.rows,
      chunks: chunksResult.rows,
      query,
      total: result.rows.length
    })
  } catch (error) {
    console.error('Error searching knowledge base:', error)
    return NextResponse.json({ error: 'Failed to search knowledge base' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      userId = 'demo-user', 
      query, 
      context, 
      templateId,
      emailContent 
    } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const client = await pool.connect()
    
    // Get relevant knowledge for AI context
    const documentsResult = await client.query(`
      SELECT * FROM search_knowledge_base($1, $2, NULL, 5)
    `, [userId, query])

    const chunksResult = await client.query(`
      SELECT * FROM get_relevant_chunks($1, $2, 8)
    `, [userId, query])

    // Build AI context from relevant knowledge
    const knowledgeContext = {
      relevantDocuments: documentsResult.rows.map(doc => ({
        title: doc.title,
        category: doc.category,
        snippet: doc.snippet,
        relevanceScore: doc.relevance_score
      })),
      relevantChunks: chunksResult.rows.map(chunk => ({
        text: chunk.chunk_text,
        documentTitle: chunk.document_title,
        sectionTitle: chunk.section_title,
        relevanceScore: chunk.relevance_score
      })),
      businessContext: context,
      templateContext: templateId ? await getTemplateContext(client, templateId) : null
    }

    client.release()

    // Here you would integrate with your AI service to generate enhanced email content
    // For now, return the context that would be sent to AI
    const aiPrompt = buildAIPrompt(knowledgeContext, query, emailContent)

    return NextResponse.json({ 
      knowledgeContext,
      aiPrompt,
      suggestions: generateBasicSuggestions(knowledgeContext, query)
    })
  } catch (error) {
    console.error('Error processing knowledge search:', error)
    return NextResponse.json({ error: 'Failed to process knowledge search' }, { status: 500 })
  }
}

async function getTemplateContext(client: any, templateId: string) {
  try {
    const result = await client.query(`
      SELECT name, description, ai_instructions, tone, category
      FROM email_templates 
      WHERE id = $1
    `, [templateId])
    
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching template context:', error)
    return null
  }
}

function buildAIPrompt(knowledgeContext: any, query: string, emailContent?: string): string {
  let prompt = `You are an AI assistant helping to write professional business emails using relevant company knowledge.

CONTEXT QUERY: ${query}

RELEVANT BUSINESS KNOWLEDGE:
`

  // Add document context
  if (knowledgeContext.relevantDocuments.length > 0) {
    prompt += "\nRELEVANT DOCUMENTS:\n"
    knowledgeContext.relevantDocuments.forEach((doc: any, index: number) => {
      prompt += `${index + 1}. ${doc.title} (${doc.category}): ${doc.snippet}\n`
    })
  }

  // Add chunk context
  if (knowledgeContext.relevantChunks.length > 0) {
    prompt += "\nRELEVANT CONTENT SECTIONS:\n"
    knowledgeContext.relevantChunks.forEach((chunk: any, index: number) => {
      prompt += `${index + 1}. From "${chunk.documentTitle}": ${chunk.text.slice(0, 200)}...\n`
    })
  }

  // Add template context
  if (knowledgeContext.templateContext) {
    const template = knowledgeContext.templateContext
    prompt += `\nTEMPLATE CONTEXT:
- Template: ${template.name} (${template.category})
- Tone: ${template.tone}
- AI Instructions: ${template.ai_instructions}
`
  }

  prompt += `\nTASK: ${emailContent ? 
    'Enhance the following email draft using the above knowledge:' : 
    'Help draft an email response using the above knowledge:'
  }

${emailContent || 'Please provide suggestions for an appropriate email response.'}

REQUIREMENTS:
- Use information from the relevant business knowledge above
- Maintain a professional tone
- Be accurate and helpful
- Include specific details from the knowledge base when relevant
- Ensure all claims are supported by the provided context
`

  return prompt
}

function generateBasicSuggestions(knowledgeContext: any, query: string): string[] {
  const suggestions: string[] = []
  
  // Generate suggestions based on relevant documents
  knowledgeContext.relevantDocuments.forEach((doc: any) => {
    if (doc.category === 'Company Policies') {
      suggestions.push(`Reference company policy from "${doc.title}"`)
    } else if (doc.category === 'Product Information') {
      suggestions.push(`Include product details from "${doc.title}"`)
    } else if (doc.category === 'Customer Service') {
      suggestions.push(`Use customer service guidelines from "${doc.title}"`)
    }
  })

  // Add generic suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      'Consider referencing relevant company policies',
      'Include specific product or service details',
      'Maintain professional tone consistent with company standards'
    )
  }

  return suggestions.slice(0, 5)
}