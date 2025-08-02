import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { createEmbeddingService, EmbeddingService } from './embedding-service'

export interface ProcessedDocument {
  extractedText: string
  pageCount?: number
  wordCount: number
  summary?: string
  keyTopics?: string[]
  chunks: DocumentChunk[]
  embeddings?: {
    titleEmbedding?: number[]
    contentEmbedding?: number[]
    combinedEmbedding?: number[]
  }
}

export interface DocumentChunk {
  text: string
  index: number
  pageNumber?: number
  sectionTitle?: string
  chunkType: 'paragraph' | 'heading' | 'list' | 'table'
  contextBefore?: string
  contextAfter?: string
  embedding?: number[]
}

export class DocumentProcessor {
  private static readonly CHUNK_SIZE = 1000 // characters
  private static readonly CHUNK_OVERLAP = 200 // characters

  static async processDocument(
    filePath: string, 
    fileName: string, 
    mimeType: string
  ): Promise<ProcessedDocument> {
    try {
      const fileBuffer = await fs.readFile(filePath)
      const fileExtension = path.extname(fileName).toLowerCase()
      
      let extractedText = ''
      let pageCount: number | undefined

      // Extract text based on file type
      switch (fileExtension) {
        case '.pdf':
          try {
            // Temporarily disable PDF processing to avoid test file access issues
            // This is a known issue with the pdf-parse library
            console.log('Processing PDF document...')
            extractedText = `[PDF Document] - PDF text extraction is temporarily disabled due to library compatibility issues. Please convert to TXT or DOCX format for full text processing.`
            pageCount = 1
            
            // Alternative: Basic PDF info without text extraction
            const fileSizeKB = Math.round(fileBuffer.length / 1024)
            extractedText += `\n\nDocument Info:\n- File size: ${fileSizeKB} KB\n- Format: PDF\n- Processing status: Uploaded successfully, awaiting manual text extraction`
          } catch (error) {
            console.error('PDF processing error:', error)
            extractedText = `[PDF Document] - Upload successful. Please use TXT or DOCX format for automatic text extraction.`
            pageCount = 1
          }
          break

        case '.docx':
          try {
            const mammoth = await import('mammoth')
            const docxResult = await mammoth.extractRawText({ buffer: fileBuffer })
            extractedText = docxResult.value
          } catch (error) {
            throw new Error(`DOCX processing failed: ${error.message}`)
          }
          break

        case '.txt':
        case '.md':
          extractedText = fileBuffer.toString('utf-8')
          break

        case '.html':
          extractedText = this.extractTextFromHtml(fileBuffer.toString('utf-8'))
          break

        case '.xlsx':
        case '.xls':
          try {
            extractedText = await this.extractTextFromExcel(fileBuffer)
          } catch (error) {
            throw new Error(`Excel processing failed: ${error.message}`)
          }
          break

        case '.csv':
          extractedText = fileBuffer.toString('utf-8')
          break

        default:
          throw new Error(`Unsupported file type: ${fileExtension}`)
      }

      // Clean and normalize text
      extractedText = this.cleanText(extractedText)
      
      // Calculate word count
      const wordCount = this.countWords(extractedText)
      
      // Create chunks
      const chunks = this.createChunks(extractedText, pageCount)
      
      // Generate basic summary and topics (you can enhance this with AI later)
      const summary = this.generateBasicSummary(extractedText)
      const keyTopics = this.extractKeyTopics(extractedText)

      return {
        extractedText,
        pageCount,
        wordCount,
        summary,
        keyTopics,
        chunks
      }
    } catch (error) {
      console.error('Error processing document:', error)
      throw new Error(`Failed to process document: ${error.message}`)
    }
  }

  static async generateEmbeddings(
    document: ProcessedDocument,
    title: string,
    description?: string
  ): Promise<ProcessedDocument> {
    try {
      const embeddingService = createEmbeddingService()
      
      // Generate document-level embeddings
      const titleEmbedding = await embeddingService.generateEmbedding(title)
      const contentEmbedding = await embeddingService.generateEmbedding(document.extractedText)
      
      // Generate combined embedding (title + description + content)
      const combinedText = EmbeddingService.combineTexts(
        title,
        document.extractedText,
        description
      )
      const combinedEmbedding = await embeddingService.generateEmbedding(combinedText)
      
      // Generate embeddings for chunks
      const chunkTexts = document.chunks.map(chunk => chunk.text)
      const chunkEmbeddings = await embeddingService.generateMultipleEmbeddings(chunkTexts)
      
      // Add embeddings to chunks
      const chunksWithEmbeddings = document.chunks.map((chunk, index) => ({
        ...chunk,
        embedding: chunkEmbeddings[index]?.embedding
      }))
      
      return {
        ...document,
        chunks: chunksWithEmbeddings,
        embeddings: {
          titleEmbedding: titleEmbedding.embedding,
          contentEmbedding: contentEmbedding.embedding,
          combinedEmbedding: combinedEmbedding.embedding
        }
      }
    } catch (error) {
      console.error('Error generating embeddings:', error)
      // Return document without embeddings if generation fails
      return document
    }
  }

  static generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  static async saveUploadedFile(
    fileBuffer: Buffer,
    originalFilename: string,
    uploadsDir: string = './uploads'
  ): Promise<{ filePath: string; filename: string; fileHash: string }> {
    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true })
    
    // Generate unique filename
    const fileHash = this.generateFileHash(fileBuffer)
    const fileExtension = path.extname(originalFilename)
    const filename = `${fileHash}${fileExtension}`
    const filePath = path.join(uploadsDir, filename)
    
    // Save file
    await fs.writeFile(filePath, fileBuffer)
    
    return { filePath, filename, fileHash }
  }

  private static cleanText(text: string): string {
    return this.sanitizeForDatabase(text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s{2,}/g, ' ') // Remove excessive spaces
      .trim())
  }

  private static sanitizeForDatabase(text: string): string {
    if (!text) return ''
    
    return text
      .replace(/\0/g, '') // Remove null bytes that cause PostgreSQL encoding errors
      .replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '') // Remove control characters except \t, \n, \r
      .replace(/[^\x20-\x7E\x0A\x0D\x09\u00A0-\uFFFF]/g, '') // Keep only printable characters and common Unicode
      .replace(/\uFFFD/g, '') // Remove Unicode replacement characters
      .trim()
  }

  private static countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  private static createChunks(text: string, pageCount?: number): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const sentences = this.splitIntoSentences(text)
    
    let currentChunk = ''
    let chunkIndex = 0
    let sentenceIndex = 0

    for (const sentence of sentences) {
      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + sentence.length > this.CHUNK_SIZE && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          chunkType: this.detectChunkType(currentChunk),
          contextBefore: chunkIndex > 0 ? chunks[chunkIndex - 1]?.text.slice(-this.CHUNK_OVERLAP) : undefined,
          contextAfter: undefined // Will be filled in next iteration
        })

        // Set context for previous chunk
        if (chunkIndex > 0) {
          chunks[chunkIndex - 1].contextAfter = currentChunk.slice(0, this.CHUNK_OVERLAP)
        }

        // Start new chunk with overlap
        const overlap = currentChunk.slice(-this.CHUNK_OVERLAP)
        currentChunk = overlap + ' ' + sentence
        chunkIndex++
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
      
      sentenceIndex++
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        chunkType: this.detectChunkType(currentChunk),
        contextBefore: chunkIndex > 0 ? chunks[chunkIndex - 1]?.text.slice(-this.CHUNK_OVERLAP) : undefined
      })
    }

    return chunks
  }

  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with NLP libraries
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.')
  }

  private static detectChunkType(text: string): 'paragraph' | 'heading' | 'list' | 'table' {
    // Simple heuristics to detect chunk types
    if (text.match(/^\s*#|^[A-Z][^.]*:?\s*$/m)) {
      return 'heading'
    }
    if (text.match(/^\s*[\-\*\+•]\s|^\s*\d+\.\s/m)) {
      return 'list'
    }
    if (text.match(/\|\s*\w+\s*\||\t\w+\t/)) {
      return 'table'
    }
    return 'paragraph'
  }

  private static generateBasicSummary(text: string, maxLength: number = 300): string {
    // Simple extractive summary - first few sentences
    const sentences = this.splitIntoSentences(text)
    let summary = ''
    
    for (const sentence of sentences.slice(0, 3)) {
      if (summary.length + sentence.length <= maxLength) {
        summary += sentence + ' '
      } else {
        break
      }
    }
    
    const result = summary.trim() || text.slice(0, maxLength) + '...'
    return this.sanitizeForDatabase(result)
  }

  private static extractKeyTopics(text: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    // Count word frequency
    const wordFreq: { [key: string]: number } = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })
    
    // Get top words
    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
      .filter(word => !this.isStopWord(word))
    
    return topWords.slice(0, 5).map(topic => this.sanitizeForDatabase(topic))
  }

  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that',
      'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
      'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
      'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
      'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
      'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
      'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'should', 'could',
      'can', 'may', 'might', 'must', 'shall'
    ])
    return stopWords.has(word.toLowerCase())
  }

  private static extractTextFromHtml(html: string): string {
    // Simple HTML text extraction - remove tags
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  private static async extractTextFromExcel(buffer: Buffer): Promise<string> {
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      let text = ''
      
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName]
        const sheetText = XLSX.utils.sheet_to_txt(sheet, { header: 1 })
        text += `Sheet: ${sheetName}\n${sheetText}\n\n`
      })
      
      return text
    } catch (error) {
      throw new Error(`Excel processing failed: ${error.message}`)
    }
  }
}

// AI Enhancement Functions (can be expanded with actual AI integration)
export class AIDocumentProcessor {
  static async enhanceWithAI(
    document: ProcessedDocument,
    category?: string
  ): Promise<{
    enhancedSummary: string
    businessContext: any
    improvedTopics: string[]
  }> {
    // Placeholder for AI enhancement
    // In a real implementation, you would call your AI service here
    
    return {
      enhancedSummary: document.summary || '',
      businessContext: {
        documentType: this.detectDocumentType(document.extractedText),
        keyEntities: this.extractBusinessEntities(document.extractedText),
        actionItems: this.extractActionItems(document.extractedText)
      },
      improvedTopics: document.keyTopics || []
    }
  }

  private static detectDocumentType(text: string): string {
    // Simple document type detection
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('policy') || lowerText.includes('procedure')) return 'policy'
    if (lowerText.includes('contract') || lowerText.includes('agreement')) return 'legal'
    if (lowerText.includes('product') || lowerText.includes('feature')) return 'product'
    if (lowerText.includes('customer') || lowerText.includes('support')) return 'support'
    if (lowerText.includes('marketing') || lowerText.includes('campaign')) return 'marketing'
    
    return 'general'
  }

  private static extractBusinessEntities(text: string): string[] {
    // Simple entity extraction - can be enhanced with NER
    const entities: string[] = []
    
    // Extract email addresses
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g)
    if (emails) entities.push(...emails)
    
    // Extract phone numbers
    const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g)
    if (phones) entities.push(...phones)
    
    // Extract currency amounts
    const amounts = text.match(/\$[\d,]+\.?\d*/g)
    if (amounts) entities.push(...amounts)
    
    return entities
  }

  private static extractActionItems(text: string): string[] {
    // Extract potential action items
    const actionPatterns = [
      /(?:must|should|need to|required to|have to)\s+([^.!?]+)/gi,
      /(?:action|todo|task):\s*([^.!?]+)/gi,
      /(?:please|kindly)\s+([^.!?]+)/gi
    ]
    
    const actions: string[] = []
    
    actionPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        actions.push(...matches.map(match => match.trim()))
      }
    })
    
    return actions.slice(0, 5) // Limit to top 5
  }
}