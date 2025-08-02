"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, Search, FileText, Lightbulb, Zap, BookOpen, 
  CheckCircle, ArrowRight, Sparkles, Target
} from "lucide-react"

interface KnowledgeDocument {
  id: string
  title: string
  description?: string
  category?: string
  relevanceScore?: number
  snippet?: string
}

interface KnowledgeChunk {
  chunkText: string
  documentTitle: string
  sectionTitle?: string
  relevanceScore?: number
}

interface KnowledgeContext {
  relevantDocuments: KnowledgeDocument[]
  relevantChunks: KnowledgeChunk[]
  suggestions: string[]
  aiPrompt?: string
}

interface KnowledgeAssistantProps {
  query: string
  templateId?: string
  emailContent?: string
  onSuggestionApply?: (suggestion: string) => void
  onContextUpdate?: (context: KnowledgeContext) => void
}

export default function KnowledgeAssistant({ 
  query, 
  templateId, 
  emailContent,
  onSuggestionApply,
  onContextUpdate 
}: KnowledgeAssistantProps) {
  const [knowledgeContext, setKnowledgeContext] = useState<KnowledgeContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(query)

  useEffect(() => {
    if (query) {
      searchKnowledge(query)
    }
  }, [query, templateId])

  const searchKnowledge = async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'demo-user',
          query: searchQuery,
          templateId,
          emailContent
        })
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledgeContext(data.knowledgeContext)
        onContextUpdate?.(data.knowledgeContext)
      }
    } catch (error) {
      console.error('Error searching knowledge base:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = () => {
    searchKnowledge(searchQuery)
  }

  if (!knowledgeContext && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Brain className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-4">
            Search your knowledge base to get AI-powered suggestions
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Search for relevant information..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
            />
            <Button onClick={handleManualSearch}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
        />
        <Button onClick={handleManualSearch} disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Searching knowledge base...</p>
          </CardContent>
        </Card>
      )}

      {knowledgeContext && (
        <div className="space-y-4">
          {/* AI Suggestions */}
          {knowledgeContext.suggestions && knowledgeContext.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI Suggestions
                </CardTitle>
                <CardDescription>
                  Smart suggestions based on your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {knowledgeContext.suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">{suggestion}</span>
                    </div>
                    {onSuggestionApply && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => onSuggestionApply(suggestion)}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Relevant Documents */}
          {knowledgeContext.relevantDocuments && knowledgeContext.relevantDocuments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Relevant Documents
                </CardTitle>
                <CardDescription>
                  Documents from your knowledge base that match your query
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {knowledgeContext.relevantDocuments.map((doc, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{doc.title}</h4>
                        {doc.category && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {doc.category}
                          </Badge>
                        )}
                      </div>
                      {doc.relevanceScore && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Target className="w-3 h-3" />
                          {Math.round(doc.relevanceScore * 100)}%
                        </div>
                      )}
                    </div>
                    {doc.snippet && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {doc.snippet}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Relevant Content Chunks */}
          {knowledgeContext.relevantChunks && knowledgeContext.relevantChunks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-green-600" />
                  Relevant Content
                </CardTitle>
                <CardDescription>
                  Specific sections that match your needs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {knowledgeContext.relevantChunks.map((chunk, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{chunk.documentTitle}</h4>
                        {chunk.sectionTitle && (
                          <p className="text-xs text-gray-500">{chunk.sectionTitle}</p>
                        )}
                      </div>
                      {chunk.relevanceScore && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Target className="w-3 h-3" />
                          {Math.round(chunk.relevanceScore * 100)}%
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                      {chunk.chunkText.length > 200 
                        ? chunk.chunkText.substring(0, 200) + '...' 
                        : chunk.chunkText
                      }
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Context Indicator */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Knowledge Context Active
                  </p>
                  <p className="text-xs text-green-600">
                    AI will use {knowledgeContext.relevantDocuments.length} documents and {knowledgeContext.relevantChunks.length} content sections for enhanced responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}