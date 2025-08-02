// Embedding service for generating vector embeddings
// Supports multiple embedding providers: OpenAI, local models, etc.

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'mock'
  model?: string
  dimensions?: number
  apiKey?: string
}

export interface EmbeddingResult {
  embedding: number[]
  model: string
  dimensions: number
  usage?: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class EmbeddingService {
  private config: EmbeddingConfig

  constructor(config: EmbeddingConfig) {
    this.config = config
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Clean and prepare text
    const cleanText = this.preprocessText(text)
    
    switch (this.config.provider) {
      case 'openai':
        return this.generateOpenAIEmbedding(cleanText)
      case 'local':
        return this.generateLocalEmbedding(cleanText)
      case 'mock':
        return this.generateMockEmbedding(cleanText)
      default:
        throw new Error(`Unsupported embedding provider: ${this.config.provider}`)
    }
  }

  async generateMultipleEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    // For now, generate embeddings sequentially to avoid rate limits
    // In production, you might want to batch these
    const results: EmbeddingResult[] = []
    
    for (const text of texts) {
      try {
        const result = await this.generateEmbedding(text)
        results.push(result)
        
        // Small delay to avoid rate limiting
        if (this.config.provider === 'openai') {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, error)
        // Push a mock embedding to maintain array consistency
        results.push(this.generateMockEmbedding(text))
      }
    }
    
    return results
  }

  private preprocessText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters but keep basic punctuation
      .trim()
      .substring(0, 8000) // Limit length to avoid token limits
  }

  private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required for OpenAI embeddings')
    }

    const model = this.config.model || 'text-embedding-ada-002'
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: model
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        embedding: data.data[0].embedding,
        model: model,
        dimensions: data.data[0].embedding.length,
        usage: data.usage
      }
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error)
      // Fallback to mock embedding
      return this.generateMockEmbedding(text)
    }
  }

  private async generateLocalEmbedding(text: string): Promise<EmbeddingResult> {
    // Placeholder for local embedding model
    // You could integrate with models like sentence-transformers, etc.
    console.log('Local embeddings not implemented yet, using mock embeddings')
    return this.generateMockEmbedding(text)
  }

  private generateMockEmbedding(text: string): EmbeddingResult {
    // Generate a consistent mock embedding based on text content
    // This is for development/testing purposes only
    const dimensions = this.config.dimensions || 1536
    const embedding: number[] = []
    
    // Create a simple hash-based embedding that's consistent for the same text
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Generate embedding values based on hash and text characteristics
    for (let i = 0; i < dimensions; i++) {
      const seed = hash + i * 31
      const value = (Math.sin(seed) * 0.5) + (Math.cos(seed * 1.5) * 0.3) + (Math.sin(seed * 0.7) * 0.2)
      embedding.push(value)
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    const normalizedEmbedding = embedding.map(val => val / magnitude)
    
    return {
      embedding: normalizedEmbedding,
      model: 'mock-embedding-model',
      dimensions: dimensions
    }
  }

  // Helper method to combine multiple text pieces for a single embedding
  static combineTexts(title: string, content: string, description?: string): string {
    const parts = [title]
    if (description) parts.push(description)
    if (content) parts.push(content)
    return parts.join(' | ')
  }

  // Helper method to chunk long text for embedding
  static chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    if (text.length <= maxChunkSize) {
      return [text]
    }

    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      let end = start + maxChunkSize
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end)
        const lastExclamation = text.lastIndexOf('!', end)
        const lastQuestion = text.lastIndexOf('?', end)
        const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
        
        if (lastSentenceEnd > start + maxChunkSize / 2) {
          end = lastSentenceEnd + 1
        }
      }
      
      chunks.push(text.substring(start, end).trim())
      start = Math.max(start + maxChunkSize - overlap, end)
    }

    return chunks
  }
}

// Factory function to create embedding service based on environment
export function createEmbeddingService(): EmbeddingService {
  const provider = process.env.EMBEDDING_PROVIDER as EmbeddingConfig['provider'] || 'mock'
  
  const config: EmbeddingConfig = {
    provider,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
    apiKey: process.env.OPENAI_API_KEY
  }

  return new EmbeddingService(config)
}