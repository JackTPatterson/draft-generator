"use client"

import { Badge } from "@/components/ui/badge"

interface Citation {
  id: string
  label: string
  title: string
  category?: string
  type: 'document' | 'chunk'
  relevanceScore: number
}

interface SourceBadgesProps {
  citations?: Citation[]
  usedCitations?: string[]
}

export default function SourceBadges({ citations = [], usedCitations = [] }: SourceBadgesProps) {
  if (citations.length === 0) {
    return null
  }

  const usedCitationsSet = new Set(usedCitations)
  const citedSources = citations.filter(c => usedCitationsSet.has(c.id))

  // Show only the citations that were actually used in the content
  return (
    <div className="flex flex-wrap gap-1">
      {citedSources.map((citation) => (
        <Badge key={citation.id} className="self-start" variant="outline">
          {citation.label}
        </Badge>
      ))}
    </div>
  )
}