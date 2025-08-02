"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  BookOpen, ChevronDown, ChevronRight, Info, Shield, Building, 
  Scale, Megaphone, Users, FileText, ExternalLink
} from "lucide-react"

interface Citation {
  id: string
  label: string
  title: string
  category?: string
  section?: string
  type: 'document' | 'chunk'
  relevanceScore: number
  snippet?: string
  text?: string
}

interface DraftCitationsProps {
  citations: Citation[]
  usedCitations?: string[]
  className?: string
  compact?: boolean
}

const categoryIcons: { [key: string]: any } = {
  'Company Policies': Shield,
  'Product Information': Building,
  'Legal Documents': Scale,
  'Marketing Materials': Megaphone,
  'Customer Service': Users,
  default: FileText
}

const categoryColors: { [key: string]: string } = {
  'Company Policies': 'bg-blue-50 text-blue-700 border-blue-200',
  'Product Information': 'bg-green-50 text-green-700 border-green-200',
  'Legal Documents': 'bg-red-50 text-red-700 border-red-200',
  'Marketing Materials': 'bg-purple-50 text-purple-700 border-purple-200',
  'Customer Service': 'bg-orange-50 text-orange-700 border-orange-200',
  default: 'bg-gray-50 text-gray-700 border-gray-200'
}

export default function DraftCitations({ 
  citations = [], 
  usedCitations = [],
  className = "",
  compact = true
}: DraftCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (citations.length === 0) {
    return (
      <div className={`text-xs text-gray-500 italic ${className}`}>
        No knowledge sources referenced
      </div>
    )
  }

  const usedCitationsSet = new Set(usedCitations)
  const citedSources = citations.filter(c => usedCitationsSet.has(c.id))
  const availableSources = citations.filter(c => !usedCitationsSet.has(c.id))

  const getCategoryIcon = (category?: string) => {
    const IconComponent = categoryIcons[category || 'default'] || categoryIcons.default
    return <IconComponent className="w-3 h-3" />
  }

  const getCategoryColor = (category?: string) => {
    return categoryColors[category || 'default'] || categoryColors.default
  }

  if (compact) {
    return (
      <div className={className}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 p-1 text-xs flex items-center gap-1 text-gray-600 hover:text-gray-800"
            >
              <BookOpen className="w-3 h-3" />
              <span>
                {citedSources.length > 0 ? (
                  <>
                    {citedSources.length} source{citedSources.length !== 1 ? 's' : ''} cited
                    {availableSources.length > 0 && (
                      <span className="text-gray-400 ml-1">
                        (+{availableSources.length} available)
                      </span>
                    )}
                  </>
                ) : (
                  `${citations.length} source${citations.length !== 1 ? 's' : ''} available`
                )}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {/* Cited Sources */}
              {citedSources.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-700">Referenced in Draft</span>
                  </div>
                  <div className="space-y-1 ml-3">
                    {citedSources.map((citation) => (
                      <div key={citation.id} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="px-1 py-0 text-[10px] bg-green-50 text-green-700 border-green-300">
                          {citation.label}
                        </Badge>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {getCategoryIcon(citation.category)}
                          <span className="truncate text-gray-700">{citation.title}</span>
                          {citation.category && (
                            <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(citation.category)}`}>
                              {citation.category}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {Math.round(citation.relevanceScore * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Sources */}
              {availableSources.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-600">Available Sources</span>
                  </div>
                  <div className="space-y-1 ml-3">
                    {availableSources.slice(0, 3).map((citation) => (
                      <div key={citation.id} className="flex items-center gap-2 text-xs opacity-75">
                        <Badge variant="outline" className="px-1 py-0 text-[10px] bg-gray-50 text-gray-600">
                          {citation.label}
                        </Badge>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {getCategoryIcon(citation.category)}
                          <span className="truncate text-gray-600">{citation.title}</span>
                          {citation.category && (
                            <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(citation.category)} opacity-75`}>
                              {citation.category}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {Math.round(citation.relevanceScore * 100)}%
                        </span>
                      </div>
                    ))}
                    {availableSources.length > 3 && (
                      <div className="text-[10px] text-gray-500 ml-4">
                        +{availableSources.length - 3} more sources available
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="pt-1 border-t border-gray-100">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>
                    {citedSources.length}/{citations.length} sources used
                  </span>
                  <span>
                    Avg relevance: {Math.round(citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  // Full display mode (non-compact)
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Knowledge Sources
          <Badge variant="secondary" className="ml-auto text-xs">
            {citations.length}
          </Badge>
        </CardTitle>
        {citedSources.length > 0 && (
          <CardDescription className="text-xs">
            {citedSources.length} source{citedSources.length !== 1 ? 's' : ''} referenced in this draft
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {citedSources.map((citation) => (
          <div key={citation.id} className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
            <Badge className="px-1 py-0 text-xs bg-green-100 text-green-700">
              {citation.label}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                {getCategoryIcon(citation.category)}
                <span className="text-sm font-medium truncate">{citation.title}</span>
                {citation.category && (
                  <Badge className={`text-xs ${getCategoryColor(citation.category)}`}>
                    {citation.category}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">
                {citation.snippet || citation.text}
              </p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {citation.type === 'document' ? 'Document' : 'Section'}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(citation.relevanceScore * 100)}% match
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}