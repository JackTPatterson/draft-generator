"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  BookOpen, ChevronDown, ChevronRight, ExternalLink, Info, 
  FileText, Building, Scale, Megaphone, Users, Shield
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

interface CitationsPanelProps {
  citations: Citation[]
  usedCitations?: string[] // Citation IDs that were actually used in the content
  className?: string
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
  'Company Policies': 'bg-blue-100 text-blue-800',
  'Product Information': 'bg-green-100 text-green-800',
  'Legal Documents': 'bg-red-100 text-red-800',
  'Marketing Materials': 'bg-purple-100 text-purple-800',
  'Customer Service': 'bg-orange-100 text-orange-800',
  default: 'bg-gray-100 text-gray-800'
}

export default function CitationsPanel({ 
  citations = [], 
  usedCitations = [],
  className = "" 
}: CitationsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())

  if (citations.length === 0) {
    return null
  }

  const toggleCitation = (citationId: string) => {
    const newExpanded = new Set(expandedCitations)
    if (newExpanded.has(citationId)) {
      newExpanded.delete(citationId)
    } else {
      newExpanded.add(citationId)
    }
    setExpandedCitations(newExpanded)
  }

  const getCategoryIcon = (category?: string) => {
    const IconComponent = categoryIcons[category || 'default'] || categoryIcons.default
    return <IconComponent className="w-4 h-4" />
  }

  const getCategoryColor = (category?: string) => {
    return categoryColors[category || 'default'] || categoryColors.default
  }

  const usedCitationsSet = new Set(usedCitations)
  const sortedCitations = [...citations].sort((a, b) => {
    // Sort used citations first, then by relevance score
    const aUsed = usedCitationsSet.has(a.id) ? 1 : 0
    const bUsed = usedCitationsSet.has(b.id) ? 1 : 0
    if (aUsed !== bUsed) return bUsed - aUsed
    return b.relevanceScore - a.relevanceScore
  })

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 " />
            <CardTitle className="text-lg">Knowledge Sources</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {citations.length} source{citations.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {isExpanded ? 'Collapse' : 'View Sources'}
          </Button>
        </div>
        <CardDescription>
          Sources referenced in this email draft
          {usedCitations.length > 0 && (
            <span className="ml-2  font-medium">
              ({usedCitations.length} cited)
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {sortedCitations.map((citation, index) => {
                const isUsed = usedCitationsSet.has(citation.id)
                const isExpanded = expandedCitations.has(citation.id)
                
                return (
                  <div key={citation.id} className="space-y-2">
                    <div 
                      className={`p-3 rounded-lg border ${
                        isUsed 
                          ? 'bg-green-50 border-green-200' 
                          : ' border-gray-200'
                      } transition-colors`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={isUsed ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {citation.label}
                            </Badge>
                            {isUsed && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                ✓ Cited
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span>{Math.round(citation.relevanceScore * 100)}% match</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(citation.category)}
                            <span className="font-medium text-sm">{citation.title}</span>
                            {citation.category && (
                              <Badge 
                                className={`text-xs ${getCategoryColor(citation.category)}`}
                              >
                                {citation.category}
                              </Badge>
                            )}
                          </div>

                          {citation.section && (
                            <div className="text-xs text-gray-500">
                              Section: {citation.section}
                            </div>
                          )}

                          <div className="text-sm text-gray-700">
                            {citation.snippet || citation.text}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCitation(citation.id)}
                            className="p-1 h-6 w-6"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <Info className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="space-y-2 text-xs text-gray-500">
                            <div><strong>Type:</strong> {citation.type === 'document' ? 'Full Document' : 'Content Section'}</div>
                            <div><strong>Relevance:</strong> {(citation.relevanceScore * 100).toFixed(1)}%</div>
                            {citation.type === 'chunk' && citation.section && (
                              <div><strong>Section:</strong> {citation.section}</div>
                            )}
                            <div><strong>Usage:</strong> {isUsed ? 'Referenced in email' : 'Available but not used'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {index < sortedCitations.length - 1 && <Separator />}
                  </div>
                )
              })}
            </div>

            {usedCitations.length === 0 && citations.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">No sources were cited in this draft</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Consider adding references to these relevant sources to improve credibility and accuracy.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}