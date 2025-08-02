"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, Sparkles, FileText, Plus, Search, Zap, Target, 
  BookOpen, Lightbulb, ArrowRight, CheckCircle, X
} from "lucide-react"
import KnowledgeAssistant from "./KnowledgeAssistant"

interface AIEnhancedTemplateFormProps {
  template?: any
  categories: any[]
  onSave: (data: any) => void
  onCancel: () => void
}

export default function AIEnhancedTemplateForm({ 
  template, 
  categories, 
  onSave, 
  onCancel 
}: AIEnhancedTemplateFormProps) {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    category: template?.category || "",
    type: template?.type || "reply",
    tone: template?.tone || "professional",
    subject_template: template?.subject_template || "",
    body_template: template?.body_template || "",
    ai_instructions: template?.ai_instructions || "",
    tags: template?.tags?.join(", ") || "",
  })

  const [knowledgeQuery, setKnowledgeQuery] = useState("")
  const [knowledgeContext, setKnowledgeContext] = useState<any>(null)
  const [showKnowledgeAssistant, setShowKnowledgeAssistant] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  const handleKnowledgeSearch = () => {
    if (formData.description || formData.name) {
      const query = `${formData.name} ${formData.description} ${formData.category}`.trim()
      setKnowledgeQuery(query)
      setShowKnowledgeAssistant(true)
    }
  }

  const handleSuggestionApply = (suggestion: string) => {
    // Apply suggestion to AI instructions
    const currentInstructions = formData.ai_instructions
    const updatedInstructions = currentInstructions 
      ? `${currentInstructions}\n\n• ${suggestion}`
      : `• ${suggestion}`
    
    setFormData({ ...formData, ai_instructions: updatedInstructions })
  }

  const handleContextUpdate = (context: any) => {
    setKnowledgeContext(context)
    if (context?.suggestions) {
      setAiSuggestions(context.suggestions)
    }
  }

  const generateAIInstructions = () => {
    if (!knowledgeContext) return

    let instructions = `Based on your knowledge base, when using this template:\n\n`
    
    if (knowledgeContext.relevantDocuments?.length > 0) {
      instructions += `Reference information from:\n`
      knowledgeContext.relevantDocuments.forEach((doc: any) => {
        instructions += `• ${doc.title} (${doc.category})\n`
      })
      instructions += `\n`
    }

    if (knowledgeContext.suggestions?.length > 0) {
      instructions += `Key guidelines:\n`
      knowledgeContext.suggestions.forEach((suggestion: string) => {
        instructions += `• ${suggestion}\n`
      })
    }

    setFormData({ ...formData, ai_instructions: instructions })
  }

  const handleSave = () => {
    const data = {
      ...formData,
      tags: formData.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean),
      // Include knowledge context metadata
      knowledge_context: knowledgeContext ? {
        relevant_documents: knowledgeContext.relevantDocuments?.map((doc: any) => doc.id) || [],
        search_query: knowledgeQuery,
        created_at: new Date().toISOString()
      } : null
    }
    onSave(data)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="ai" className="relative">
            AI Enhancement
            {knowledgeContext && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Budget Review Response"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of when to use this template"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Template Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply">Reply</SelectItem>
                  <SelectItem value="forward">Forward</SelectItem>
                  <SelectItem value="new_email">New Email</SelectItem>
                  <SelectItem value="auto_response">Auto Response</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="meeting_request">Meeting Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select value={formData.tone} onValueChange={(value) => setFormData({ ...formData, tone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="apologetic">Apologetic</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="finance, review, approval (comma-separated)"
            />
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div>
            <Label htmlFor="subject_template">Subject Template</Label>
            <Input
              id="subject_template"
              value={formData.subject_template}
              onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
              placeholder="e.g., Re: [DOCUMENT_TYPE] Review - [PERIOD]"
            />
          </div>

          <div>
            <Label htmlFor="body_template">Email Body Template *</Label>
            <Textarea
              id="body_template"
              value={formData.body_template}
              onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
              placeholder="Use [VARIABLE_NAME] for dynamic content..."
              className="min-h-[200px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use square brackets for variables: [NAME], [COMPANY], [DATE], etc.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">AI Enhancement</h3>
              <p className="text-sm text-gray-500">
                Use your knowledge base to create smarter templates
              </p>
            </div>
            <Button 
              onClick={handleKnowledgeSearch}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search Knowledge
            </Button>
          </div>

          {showKnowledgeAssistant && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Knowledge Assistant
                </CardTitle>
                <CardDescription>
                  AI-powered suggestions based on your business documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KnowledgeAssistant
                  query={knowledgeQuery}
                  onSuggestionApply={handleSuggestionApply}
                  onContextUpdate={handleContextUpdate}
                />
              </CardContent>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="ai_instructions">AI Instructions</Label>
              {knowledgeContext && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={generateAIInstructions}
                  className="flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate from Knowledge
                </Button>
              )}
            </div>
            <Textarea
              id="ai_instructions"
              value={formData.ai_instructions}
              onChange={(e) => setFormData({ ...formData, ai_instructions: e.target.value })}
              placeholder="Instructions for AI when using this template..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              These instructions help AI generate better emails using this template
            </p>
          </div>

          {/* Quick Suggestions */}
          {aiSuggestions.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                  Quick Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiSuggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="text-sm">{suggestion}</span>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleSuggestionApply(suggestion)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Knowledge Context Summary */}
          {knowledgeContext && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Knowledge Context Active
                  </span>
                </div>
                <div className="text-xs text-green-700 space-y-1">
                  {knowledgeContext.relevantDocuments?.length > 0 && (
                    <div>• {knowledgeContext.relevantDocuments.length} relevant documents found</div>
                  )}
                  {knowledgeContext.relevantChunks?.length > 0 && (
                    <div>• {knowledgeContext.relevantChunks.length} content sections identified</div>
                  )}
                  <div>• AI will use this context for enhanced responses</div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} className="flex items-center gap-2">
          {knowledgeContext && <Sparkles className="w-4 h-4" />}
          {template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  )
}