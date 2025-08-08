import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const body = await request.json()
    const { 
      emailContent,
      subject,
      context,
      templateId,
      knowledgeQuery
    } = body

    if (!emailContent && !subject && !knowledgeQuery) {
      return NextResponse.json({ 
        error: 'Email content, subject, or knowledge query is required' 
      }, { status: 400 })
    }

    const client = await pool.connect()
    
    // Get relevant knowledge using vector search (with text fallback)
    const searchQuery = knowledgeQuery || `${subject} ${emailContent}`.trim()
    
    let documentsResult = { rows: [] }
    let chunksResult = { rows: [] }

    try {
      // Try vector search first
      const vectorSearchResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/knowledge/vector-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          query: searchQuery,
          limit: 5,
          searchType: 'hybrid'
        })
      })

      if (vectorSearchResponse.ok) {
        const vectorData = await vectorSearchResponse.json()
        documentsResult.rows = vectorData.results.map((result: any) => ({
          title: result.title,
          category: result.category,
          snippet: result.snippet,
          relevance_score: result.combined_score
        }))
        chunksResult.rows = vectorData.chunks.map((chunk: any) => ({
          chunk_text: chunk.text,
          document_title: chunk.document_title,
          section_title: chunk.section_title,
          relevance_score: chunk.similarity_score
        }))
      } else {
        throw new Error('Vector search failed')
      }
    } catch (vectorError) {
      console.warn('Vector search failed, falling back to text search:', vectorError)
      
      // Fallback to original text search
      documentsResult = await client.query(`
        SELECT * FROM search_knowledge_base($1, $2, NULL, 5)
      `, [userId, searchQuery])

      try {
        chunksResult = await client.query(`
          SELECT * FROM get_relevant_chunks($1, $2, 8)
        `, [userId, searchQuery])
      } catch (chunkError) {
        console.warn('Chunk search also failed:', chunkError)
        chunksResult = { rows: [] }
      }
    }

    // Get template context if templateId provided
    let templateContext = null
    if (templateId) {
      const templateResult = await client.query(`
        SELECT name, ai_instructions, tone, category, body_template, subject_template
        FROM email_templates 
        WHERE id = $1 AND user_id = $2
      `, [templateId, userId])
      
      templateContext = templateResult.rows[0] || null
    }

    client.release()

    // Build AI context with detailed source information
    const knowledgeContext = {
      relevantDocuments: documentsResult.rows.map((doc, index) => ({
        id: doc.id || `doc-${index}`,
        title: doc.title,
        category: doc.category,
        snippet: doc.snippet,
        relevanceScore: doc.relevance_score,
        citationId: `[Source ${index + 1}]`,
        sourceType: 'document'
      })),
      relevantChunks: chunksResult.rows.map((chunk, index) => ({
        id: chunk.document_id || `chunk-${index}`,
        text: chunk.chunk_text,
        documentTitle: chunk.document_title,
        sectionTitle: chunk.section_title,
        relevanceScore: chunk.relevance_score,
        citationId: `[Ref ${index + 1}]`,
        sourceType: 'chunk'
      })),
      templateContext,
      userContext: context,
      citations: [
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
    }

    // Generate AI prompt
    const aiPrompt = buildEnhancedAIPrompt(knowledgeContext, emailContent, subject, templateContext)

    // Generate suggestions based on knowledge
    const suggestions = generateEmailSuggestions(knowledgeContext, emailContent, templateContext)

    // In a real implementation, you would call your AI service here
    // For now, we'll return the context and suggestions
    const enhancedContent = await simulateAIEnhancement(emailContent, knowledgeContext, templateContext)

    return NextResponse.json({ 
      enhancedContent,
      knowledgeContext,
      suggestions,
      aiPrompt,
      originalContent: emailContent
    })

  } catch (error) {
    console.error('Error enhancing email with AI:', error)
    return NextResponse.json({ error: 'Failed to enhance email' }, { status: 500 })
  }
}

function buildEnhancedAIPrompt(
  knowledgeContext: any, 
  emailContent: string, 
  subject: string, 
  templateContext: any
): string {
  let prompt = `You are an AI assistant helping to write professional business emails using relevant company knowledge.

EMAIL CONTEXT:
Subject: ${subject || 'N/A'}
Current Content: ${emailContent || 'Starting fresh'}

RELEVANT BUSINESS KNOWLEDGE:
`

  // Add document context with citation IDs
  if (knowledgeContext.relevantDocuments.length > 0) {
    prompt += "\nRELEVANT DOCUMENTS:\n"
    knowledgeContext.relevantDocuments.forEach((doc: any, index: number) => {
      prompt += `${doc.citationId} ${doc.title} (${doc.category}): ${doc.snippet}\n`
    })
  }

  // Add content chunks with citation IDs
  if (knowledgeContext.relevantChunks.length > 0) {
    prompt += "\nRELEVANT CONTENT SECTIONS:\n"
    knowledgeContext.relevantChunks.forEach((chunk: any, index: number) => {
      prompt += `${chunk.citationId} From "${chunk.documentTitle}": ${chunk.text.slice(0, 300)}...\n`
    })
  }

  // Add template context
  if (templateContext) {
    prompt += `\nTEMPLATE CONTEXT:
- Template: ${templateContext.name}
- Tone: ${templateContext.tone}
- Category: ${templateContext.category}
- AI Instructions: ${templateContext.ai_instructions}
- Body Template: ${templateContext.body_template?.slice(0, 200)}...
`
  }

  prompt += `\nTASK: Enhance the email content using the above knowledge while maintaining professional standards.

REQUIREMENTS:
- Use specific information from the knowledge base when relevant
- Maintain the specified tone (${templateContext?.tone || 'professional'})
- IMPORTANT: When referencing information from sources, include the citation ID (e.g., [Source 1], [Ref 2]) immediately after the relevant content
- Ensure accuracy and cite knowledge sources appropriately
- Keep the email concise and actionable
- Follow any template-specific AI instructions

CITATION EXAMPLES:
- "According to our company policy [Source 1], we handle data..."
- "Our product features include contact management and pipeline tracking [Ref 1]."
- "As outlined in our guidelines [Source 2], the response time should be..."

Please provide an enhanced version of the email content with proper citations.`

  return prompt
}

function generateEmailSuggestions(
  knowledgeContext: any, 
  emailContent: string, 
  templateContext: any
): string[] {
  const suggestions: string[] = []

  // Suggestions based on relevant documents with citations
  knowledgeContext.relevantDocuments.forEach((doc: any) => {
    if (doc.category === 'Company Policies') {
      suggestions.push(`Reference company policy from "${doc.title}" ${doc.citationId} for credibility`)
    } else if (doc.category === 'Product Information') {
      suggestions.push(`Include specific product details from "${doc.title}" ${doc.citationId}`)
    } else if (doc.category === 'Customer Service') {
      suggestions.push(`Use customer service guidelines from "${doc.title}" ${doc.citationId}`)
    } else if (doc.category === 'Legal Documents') {
      suggestions.push(`Ensure compliance based on "${doc.title}" ${doc.citationId}`)
    } else if (doc.category === 'Marketing Materials') {
      suggestions.push(`Reference marketing strategy from "${doc.title}" ${doc.citationId}`)
    } else {
      suggestions.push(`Consider information from "${doc.title}" ${doc.citationId}`)
    }
  })

  // Template-specific suggestions
  if (templateContext?.ai_instructions) {
    suggestions.push(`Follow template guidance: ${templateContext.ai_instructions.slice(0, 100)}...`)
  }

  // General suggestions based on content
  if (!emailContent || emailContent.length < 50) {
    suggestions.push('Consider adding more context to make your message clearer')
  }

  if (knowledgeContext.relevantChunks.length > 0) {
    suggestions.push('Include specific examples from your knowledge base for better impact')
  }

  // Tone-specific suggestions
  if (templateContext?.tone === 'professional') {
    suggestions.push('Maintain formal language and structured presentation')
  } else if (templateContext?.tone === 'friendly') {
    suggestions.push('Use warm, approachable language while staying professional')
  }

  return suggestions.slice(0, 5) // Limit to top 5 suggestions
}

async function simulateAIEnhancement(
  originalContent: string, 
  knowledgeContext: any, 
  templateContext: any
): Promise<string> {
  // This is a simulation - in a real implementation, you would call your AI service
  
  if (!originalContent) {
    return "I'll help you draft this email using your business knowledge. Please provide more context about what you'd like to communicate."
  }

  let enhanced = originalContent

  // Add knowledge-based enhancements with citations
  if (knowledgeContext.relevantDocuments.length > 0) {
    const topDoc = knowledgeContext.relevantDocuments[0]
    enhanced += `\n\nAs outlined in our ${topDoc.title} ${topDoc.citationId}, ${topDoc.snippet.slice(0, 100)}...`
  }

  // Apply template tone
  if (templateContext?.tone === 'formal') {
    enhanced = enhanced.replace(/Hi/g, 'Dear').replace(/Thanks/g, 'Thank you')
  } else if (templateContext?.tone === 'friendly') {
    enhanced = enhanced.replace(/Dear/g, 'Hi').replace(/Sincerely/g, 'Best regards')
  }

  return enhanced
}