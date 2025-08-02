// Isolated PDF processor to prevent test file access issues
export async function processPDFBuffer(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // Import pdf-parse only when actually needed and with error isolation
    const pdfParse = (await import('pdf-parse')).default
    
    // Process PDF with minimal options to avoid file system access
    const pdfData = await pdfParse(buffer, {
      max: 0, // No page limit
    })
    
    return {
      text: pdfData.text || '',
      pageCount: pdfData.numpages || 1
    }
  } catch (error) {
    console.error('PDF processing failed:', error)
    throw new Error(`PDF processing failed: ${error.message}`)
  }
}