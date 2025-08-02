'use client'

import { useEffect, useState } from 'react'

interface SafeHtmlRendererProps {
  htmlContent: string
  className?: string
}

export function SafeHtmlRenderer({ htmlContent, className = '' }: SafeHtmlRendererProps) {
  const [sanitizedHtml, setSanitizedHtml] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const sanitizeHtml = async () => {
      try {
        // Dynamically import DOMPurify to avoid SSR issues
        const DOMPurify = (await import('dompurify')).default
        
        // Configure DOMPurify to allow common email formatting
        const cleanHtml = DOMPurify.sanitize(htmlContent, {
          ALLOWED_TAGS: [
            'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'strike', 'del',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'td', 'th',
            'hr'
          ],
          ALLOWED_ATTR: [
            'href', 'target', 'rel', 'src', 'alt', 'title',
            'class', 'style',
            'width', 'height'
          ],
          ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
          ADD_ATTR: ['target'],
          ADD_DATA_URI_TAGS: ['img']
        })
        
        setSanitizedHtml(cleanHtml)
      } catch (error) {
        console.error('Error sanitizing HTML:', error)
        // Fallback to plain text if sanitization fails
        setSanitizedHtml(htmlContent.replace(/<[^>]*>/g, ''))
      } finally {
        setIsLoading(false)
      }
    }

    if (htmlContent) {
      sanitizeHtml()
    } else {
      setIsLoading(false)
    }
  }, [htmlContent])

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    )
  }

  if (!htmlContent.trim()) {
    return <div className={className}>No content available</div>
  }

  return (
    <div 
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      style={{
        // Custom styles for email content
        lineHeight: '1.6',
        color: '#374151'
      }}
    />
  )
}