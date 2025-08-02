import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      gmail_id,
      email_content,
      custom_prompt,
      user_id = 'demo-user'
    } = body

    if (!gmail_id) {
      return NextResponse.json({ 
        error: 'gmail_id is required' 
      }, { status: 400 })
    }

    const client = await pool.connect()
    
    try {
      // Fetch the email content from database if not provided
      let emailData = null
      if (!email_content) {
        const emailResult = await client.query(`
          SELECT subject, body_text, body_html, from_email, from_name
          FROM emails 
          WHERE user_id = $1 AND gmail_message_id = $2
          LIMIT 1
        `, [user_id, gmail_id])
        
        emailData = emailResult.rows[0]
        if (!emailData) {
          return NextResponse.json({ 
            error: 'Email not found' 
          }, { status: 404 })
        }
      }

      // Get relevant knowledge using vector search
      const searchQuery = custom_prompt || 
        `${emailData?.subject || ''} ${emailData?.body_text || email_content || ''}`.trim()
      
      let documentsResult = { rows: [] }
      let chunksResult = { rows: [] }

      try {
        // Try vector search first
        const vectorSearchResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/knowledge/vector-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user_id,
            query: searchQuery,
            limit: 3, // Reduced for cleaner citations
            searchType: 'hybrid'
          })
        })

        if (vectorSearchResponse.ok) {
          const vectorData = await vectorSearchResponse.json()
          documentsResult.rows = vectorData.results?.map((result: any) => ({
            title: result.title,
            category: result.category,
            snippet: result.snippet,
            relevance_score: result.combined_score
          })) || []
          chunksResult.rows = vectorData.chunks?.map((chunk: any) => ({
            chunk_text: chunk.text,
            document_title: chunk.document_title,
            section_title: chunk.section_title,
            relevance_score: chunk.similarity_score
          })) || []
        } else {
          throw new Error('Vector search failed')
        }
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to text search:', vectorError)
        
        // Fallback to original text search
        try {
          documentsResult = await client.query(`
            SELECT * FROM search_knowledge_base($1, $2, NULL, 3)
          `, [user_id, searchQuery])

          chunksResult = await client.query(`
            SELECT * FROM get_relevant_chunks($1, $2, 5)
          `, [user_id, searchQuery])
        } catch (fallbackError) {
          console.warn('Text search also failed:', fallbackError)
          documentsResult = { rows: [] }
          chunksResult = { rows: [] }
        }
      }

      // Build enhanced AI prompt with citations
      const citations = [
        ...documentsResult.rows.map((doc, index) => ({
          id: `source-${index + 1}`,
          label: `Source ${index + 1}`,
          title: doc.title,
          category: doc.category,
          type: 'document',
          relevanceScore: doc.relevance_score,
          snippet: doc.snippet
        })),
        ...chunksResult.rows.map((chunk, index) => ({
          id: `ref-${index + 1}`,
          label: `Ref ${index + 1}`,
          title: chunk.document_title,
          section: chunk.section_title,
          type: 'chunk',
          relevanceScore: chunk.relevance_score,
          text: chunk.chunk_text?.substring(0, 150) + '...'
        }))
      ]

      // Create AI prompt that emphasizes citation usage
      const aiPrompt = buildCitationAwarePrompt(
        emailData || { body_text: email_content },
        citations,
        custom_prompt
      )

      // Generate AI response with citations
      const enhancedDraft = await generateDraftWithCitations(
        emailData || { body_text: email_content },
        citations,
        custom_prompt
      )

      return NextResponse.json({ 
        success: true,
        gmail_id,
        draft_content: enhancedDraft,
        citations,
        used_citations: extractUsedCitations(enhancedDraft),
        ai_prompt: aiPrompt,
        metadata: {
          knowledge_sources_found: citations.length,
          custom_prompt_used: !!custom_prompt,
          generated_at: new Date().toISOString()
        }
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error generating draft:', error)
    return NextResponse.json({ 
      error: 'Failed to generate draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function buildCitationAwarePrompt(
  emailData: any,
  citations: any[],
  customPrompt?: string
): string {
  let prompt = `You are an AI assistant helping to write professional business email responses using relevant company knowledge.

EMAIL TO RESPOND TO:
Subject: ${emailData.subject || 'N/A'}
From: ${emailData.from_name || emailData.from_email || 'N/A'}
Content: ${emailData.body_text || emailData.body_html || ''}

AVAILABLE KNOWLEDGE SOURCES:
`

  // Add document citations
  if (citations.length > 0) {
    citations.forEach((citation, index) => {
      if (citation.type === 'document') {
        prompt += `[${citation.label}] ${citation.title} (${citation.category}): ${citation.snippet}\n`
      } else {
        prompt += `[${citation.label}] From "${citation.title}": ${citation.text}\n`
      }
    })
  } else {
    prompt += "No specific knowledge sources available for this query.\n"
  }

  if (customPrompt) {
    prompt += `\nCUSTOM INSTRUCTIONS: ${customPrompt}\n`
  }

  prompt += `\nTASK: Write a professional email response using the above knowledge sources.

CRITICAL REQUIREMENTS:
1. **MUST include citation references**: When referencing information from knowledge sources, immediately follow it with the citation ID (e.g., [Source 1], [Ref 2])
2. **Be specific and accurate**: Only reference information that's actually provided in the sources
3. **Maintain professional tone**: Keep the response business-appropriate and well-structured
4. **Include proper citations**: Every factual claim should be backed by a citation when sources are available

CITATION EXAMPLES:
- "According to our company policy [Source 1], we handle data privacy by..."
- "Our product includes contact management and pipeline tracking [Ref 1]."
- "As outlined in our guidelines [Source 2], the standard response time is..."

Please write a complete email response with proper citations.`

  return prompt
}

async function generateDraftWithCitations(
  emailData: any,
  citations: any[],
  customPrompt?: string
): Promise<string> {
  // This is a simulation - in production, you would call your actual AI service
  // For now, create a realistic response with citations
  
  const hasKnowledge = citations.length > 0
  
  if (!hasKnowledge) {
    return `Thank you for your email regarding ${emailData.subject || 'your inquiry'}.

I appreciate you reaching out. Let me address your questions and provide the information you need.

${customPrompt ? `Based on your specific requirements: ${customPrompt}` : ''}

I'll follow up with additional details shortly. Please don't hesitate to reach out if you have any other questions.

Best regards,
[Your Name]`
  }

  // Generate response with citations based on available knowledge
  let response = `Thank you for your email regarding ${emailData.subject || 'your inquiry'}.

I'm happy to provide you with the relevant information based on our current policies and procedures.

`

  // Add content based on citations
  if (citations.some(c => c.category === 'Company Policies')) {
    response += `According to our company policies [Source 1], we maintain strict guidelines for handling such requests. `
  }

  if (citations.some(c => c.category === 'Procedures')) {
    response += `Our standard procedures [Source 2] outline the specific steps we follow to ensure compliance and quality. `
  }

  if (citations.length > 0) {
    response += `\nAs detailed in our knowledge base [${citations[0].label}], ${citations[0].snippet || citations[0].text?.substring(0, 100) + '...'}`
  }

  if (customPrompt) {
    response += `\n\nRegarding your specific request: ${customPrompt.substring(0, 100)}${customPrompt.length > 100 ? '...' : ''}`
  }

  response += `\n\nIf you need any clarification or have additional questions, please feel free to reach out.

Best regards,
[Your Name]`

  return response
}

function extractUsedCitations(content: string): string[] {
  const citationPattern = /\[(Source|Ref)\s+(\d+)\]/gi
  const matches = [...content.matchAll(citationPattern)]
  
  return matches.map(match => {
    const [, type, number] = match
    return `${type.toLowerCase()}-${number}`
  })
}