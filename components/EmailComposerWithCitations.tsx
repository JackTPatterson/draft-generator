"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Sparkles, Brain, Send, Save, RefreshCw, BookOpen, 
  Lightbulb, Info, Eye, Code
} from "lucide-react"
import CitationsPanel from "./CitationsPanel"
import CitationHighlighter from "./CitationHighlighter"

interface EmailComposerWithCitationsProps {
  initialSubject?: string
  initialContent?: string
  templateId?: string
  recipientEmail?: string
  onSend?: (email: { subject: string; content: string; citations?: any[] }) => void
  onSave?: (email: { subject: string; content: string; citations?: any[] }) => void
}

export default function EmailComposerWithCitations({
  initialSubject = "",
  initialContent = "",
  templateId,
  recipientEmail,
  onSend,
  onSave
}: EmailComposerWithCitationsProps) {
  const [subject, setSubject] = useState(initialSubject)
  const [content, setContent] = useState(initialContent)
  const [enhancedContent, setEnhancedContent] = useState("")
  const [citations, setCitations] = useState<any[]>([])
  const [usedCitations, setUsedCitations] = useState<string[]>([])
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit')

  const handleEnhanceWithAI = async () => {
    if (!content.trim() && !subject.trim()) {
      return
    }

    setIsEnhancing(true)
    try {
      const response = await fetch('/api/ai/enhance-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'demo-user',
          emailContent: content,
          subject: subject,
          templateId: templateId,
          knowledgeQuery: `${subject} ${content}`.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setEnhancedContent(data.enhancedContent)
        setCitations(data.knowledgeContext.citations || [])
        setSuggestions(data.suggestions || [])
        
        // Extract used citations from the enhanced content
        const citationPattern = /\[(Source \d+|Ref \d+)\]/g
        const matches = [...data.enhancedContent.matchAll(citationPattern)]
        const usedIds = matches.map(match => {
          const label = match[1]
          const citation = data.knowledgeContext.citations?.find((c: any) => c.label === label)
          return citation?.id
        }).filter(Boolean)
        
        setUsedCitations(usedIds)
        setActiveView('preview')
      }
    } catch (error) {
      console.error('Error enhancing email:', error)
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleApplyEnhancement = () => {
    setContent(enhancedContent)
    setActiveView('edit')
  }

  const handleSend = () => {
    const emailData = {
      subject,
      content: enhancedContent || content,
      citations: citations.filter(c => usedCitations.includes(c.id))
    }
    onSend?.(emailData)
  }

  const handleSave = () => {
    const emailData = {
      subject,
      content: enhancedContent || content,
      citations: citations.filter(c => usedCitations.includes(c.id))
    }
    onSave?.(emailData)
  }

  const handleApplySuggestion = (suggestion: string) => {
    // Extract citation reference from suggestion if present
    const citationMatch = suggestion.match(/\[(Source \d+|Ref \d+)\]/)
    if (citationMatch) {
      const enhancedSuggestion = suggestion.replace(citationMatch[0], `${citationMatch[0]}`)
      setContent(prev => prev + '\n\n' + enhancedSuggestion)
    } else {
      setContent(prev => prev + '\n\n' + suggestion)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Composition */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Compose Email
              </CardTitle>
              <CardDescription>
                Draft your email with AI-powered knowledge assistance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleEnhanceWithAI}
                disabled={isEnhancing || (!content.trim() && !subject.trim())}
                className="flex items-center gap-2"
              >
                {isEnhancing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {recipientEmail && (
            <div>
              <label className="text-sm font-medium">To:</label>
              <Input value={recipientEmail} disabled className="mt-1" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="mt-1"
            />
          </div>

          <Tabs value={activeView} onValueChange={setActiveView as any}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview with Citations
                {usedCitations.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {usedCitations.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Content:</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start typing your email content..."
                  className="mt-1 min-h-[200px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              {enhancedContent ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">AI-Enhanced Content:</label>
                    <Button
                      onClick={handleApplyEnhancement}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      Apply Enhancement
                    </Button>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CitationHighlighter
                      content={enhancedContent}
                      citations={citations}
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Use "Enhance with AI" to generate an improved version with citations</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={handleSend} className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Citations Panel */}
      {citations.length > 0 && (
        <CitationsPanel
          citations={citations}
          usedCitations={usedCitations}
        />
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              AI Suggestions
            </CardTitle>
            <CardDescription>
              Recommendations based on your knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <span className="text-sm text-yellow-800 flex-1">{suggestion}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplySuggestion(suggestion)}
                    className="ml-2 text-yellow-700 hover:text-yellow-800"
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}