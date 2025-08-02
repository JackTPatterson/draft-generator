"use client"

import { Badge } from "@/components/ui/badge"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Citation {
  id: string
  label: string
  title: string
  category?: string
  type: 'document' | 'chunk'
  relevanceScore: number
  snippet?: string
  text?: string
}

interface CitationHighlighterProps {
  content: string
  citations: Citation[]
  className?: string
}

export default function CitationHighlighter({ 
  content, 
  citations, 
  className = "" 
}: CitationHighlighterProps) {
  if (!content || citations.length === 0) {
    return <div className={className}>{content}</div>
  }

  // Create a map of citation labels to citation objects
  const citationMap = new Map()
  citations.forEach(citation => {
    citationMap.set(citation.label, citation)
  })

  // Find all citation patterns in the content
  const citationPattern = /\[(Source \d+|Ref \d+)\]/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = citationPattern.exec(content)) !== null) {
    // Add text before the citation
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      })
    }

    // Add the citation
    const citationLabel = match[1]
    const citation = citationMap.get(citationLabel)
    
    parts.push({
      type: 'citation',
      content: match[0],
      citation: citation,
      label: citationLabel
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    })
  }

  // If no citations found, return original content
  if (parts.length === 0) {
    return <div className={className}>{content}</div>
  }

  return (
    <TooltipProvider>
      <div className={className}>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.content}</span>
          } else {
            const citation = part.citation
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="mx-1 cursor-help text-xs bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    {part.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm p-3">
                  {citation ? (
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{citation.title}</div>
                      {citation.category && (
                        <div className="text-xs text-gray-600">{citation.category}</div>
                      )}
                      <div className="text-xs text-gray-700">
                        {citation.snippet || citation.text}
                      </div>
                      <div className="text-xs text-gray-500">
                        Relevance: {Math.round(citation.relevanceScore * 100)}%
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">Citation reference</div>
                  )}
                </TooltipContent>
              </Tooltip>
            )
          }
        })}
      </div>
    </TooltipProvider>
  )
}