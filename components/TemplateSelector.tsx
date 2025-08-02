"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Filter, Tag, FileText, Sparkles, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import Spinner from "@/components/Spinner";

interface EmailLabel {
  id: string
  name: string
  color: string
  icon?: string
  type: 'system' | 'category' | 'priority' | 'project' | 'custom'
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  type: 'reply' | 'forward' | 'compose'
  tone: string
  tags: string[]
  usage_count: number
  last_used_at?: string
  matching_labels?: EmailLabel[]
  priority_score?: number
  subject_template?: string
  body_template?: string
  ai_instructions?: string
}

interface TemplateSelectorProps {
  emailId?: string
  onTemplateSelect: (template: Template, customPrompt?: string) => void
  onClose: () => void
  isGenerating?: boolean
}

export default function TemplateSelector({ 
  emailId, 
  onTemplateSelect, 
  onClose, 
  isGenerating = false 
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [suggestedTemplates, setSuggestedTemplates] = useState<Template[]>([])
  const [emailLabels, setEmailLabels] = useState<EmailLabel[]>([])
  const [allLabels, setAllLabels] = useState<EmailLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedTone, setSelectedTone] = useState<string>("all")
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Fetch templates and suggestions
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch all templates
        const templatesResponse = await fetch('/api/templates')
        const templatesData = await templatesResponse.json()
        
        // Fetch all labels
        const labelsResponse = await fetch('/api/email-labels')
        const labelsData = await labelsResponse.json()
        setAllLabels(labelsData.labels || [])

        if (emailId) {
          // Fetch suggested templates for this email
          const suggestionsResponse = await fetch(`/api/emails/${emailId}/suggested-templates`)
          const suggestionsData = await suggestionsResponse.json()
          setSuggestedTemplates(suggestionsData.suggested_templates || [])
          
          // Extract email labels from suggested templates
          const emailLabelsSet = new Set<EmailLabel>()
          suggestionsData.suggested_templates?.forEach((template: Template) => {
            template.matching_labels?.forEach(label => emailLabelsSet.add(label))
          })
          setEmailLabels(Array.from(emailLabelsSet))
        }

        setTemplates(templatesData.templates || [])
      } catch (error) {
        console.error('Failed to fetch template data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [emailId])

  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    let filtered = templates.filter(template => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!template.name.toLowerCase().includes(query) &&
            !template.description.toLowerCase().includes(query) &&
            !template.tags.some(tag => tag.toLowerCase().includes(query))) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== "all" && template.category !== selectedCategory) {
        return false
      }

      // Type filter
      if (selectedType !== "all" && template.type !== selectedType) {
        return false
      }

      // Tone filter
      if (selectedTone !== "all" && template.tone !== selectedTone) {
        return false
      }

      // Label filter
      if (selectedLabels.length > 0) {
        const templateLabels = template.matching_labels?.map(l => l.id) || []
        if (!selectedLabels.some(labelId => templateLabels.includes(labelId))) {
          return false
        }
      }

      return true
    })

    // Sort by relevance - suggested templates first, then by usage
    return filtered.sort((a, b) => {
      const aIsSuggested = suggestedTemplates.some(st => st.id === a.id)
      const bIsSuggested = suggestedTemplates.some(st => st.id === b.id)
      
      if (aIsSuggested && !bIsSuggested) return -1
      if (!aIsSuggested && bIsSuggested) return 1
      
      // Sort by priority score for suggested templates
      if (aIsSuggested && bIsSuggested) {
        const aPriority = a.priority_score || 0
        const bPriority = b.priority_score || 0
        if (aPriority !== bPriority) return bPriority - aPriority
      }
      
      // Sort by usage count
      return (b.usage_count || 0) - (a.usage_count || 0)
    })
  }, [templates, suggestedTemplates, searchQuery, selectedCategory, selectedType, selectedTone, selectedLabels])

  // Get unique values for filter options
  const categories = useMemo(() => 
    Array.from(new Set(templates.map(t => t.category))).filter(Boolean), 
    [templates]
  )
  const types = useMemo(() => 
    Array.from(new Set(templates.map(t => t.type))).filter(Boolean), 
    [templates]
  )
  const tones = useMemo(() => 
    Array.from(new Set(templates.map(t => t.tone))).filter(Boolean), 
    [templates]
  )

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
  }

  const handleConfirmSelection = () => {
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate, customPrompt.trim() || undefined)
    }
  }

  const isSuggested = (template: Template) => 
    suggestedTemplates.some(st => st.id === template.id)

  const getTemplatePriorityScore = (template: Template) => 
    suggestedTemplates.find(st => st.id === template.id)?.priority_score || 0

  if (loading) {
    return (
        <Spinner/>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Select Template</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose a template to generate your response
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Email Labels (if available) */}
      {emailLabels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Email Labels:</p>
          <div className="flex flex-wrap gap-2">
            {emailLabels.map(label => (
              <Badge 
                key={label.id} 
                variant="outline" 
                style={{ borderColor: label.color, color: label.color }}
                className="text-xs"
              >
                {label.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>

        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Tone</label>
                <Select value={selectedTone} onValueChange={setSelectedTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tones</SelectItem>
                    {tones.map(tone => (
                      <SelectItem key={tone} value={tone}>
                        {tone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Label filter */}
            {allLabels.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Labels</label>
                <div className="flex flex-wrap gap-2">
                  {allLabels.map(label => (
                    <div key={label.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`label-${label.id}`}
                        checked={selectedLabels.includes(label.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLabels([...selectedLabels, label.id])
                          } else {
                            setSelectedLabels(selectedLabels.filter(id => id !== label.id))
                          }
                        }}
                      />
                      <Badge 
                        variant="outline" 
                        style={{ borderColor: label.color, color: label.color }}
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          const isSelected = selectedLabels.includes(label.id)
                          if (isSelected) {
                            setSelectedLabels(selectedLabels.filter(id => id !== label.id))
                          } else {
                            setSelectedLabels([...selectedLabels, label.id])
                          }
                        }}
                      >
                        {label.name}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{filteredTemplates.length} templates found</span>
        {suggestedTemplates.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            {suggestedTemplates.length} suggested
          </Badge>
        )}
      </div>

      {/* Template List */}
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {filteredTemplates.map(template => {
            const suggested = isSuggested(template)
            const priorityScore = getTemplatePriorityScore(template)
            const isSelected = selectedTemplate?.id === template.id

            return (
              <Card 
                key={template.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  suggested ? 'border-blue-200 bg-blue-50/50' : ''
                } ${
                  isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {template.name}
                        {suggested && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Suggested
                          </Badge>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    {suggested && priorityScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Score: {priorityScore}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.tone}
                      </Badge>
                      {template.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      Used {template.usage_count || 0} times
                    </div>
                  </div>
                  
                  {/* Show matching labels for suggested templates */}
                  {template.matching_labels && template.matching_labels.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-xs text-gray-600 mb-1">Matching labels:</div>
                      <div className="flex flex-wrap gap-1">
                        {template.matching_labels.map(label => (
                          <Badge 
                            key={label.id} 
                            variant="outline" 
                            style={{ borderColor: label.color, color: label.color }}
                            className="text-xs"
                          >
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>

      {/* Custom Prompt Section */}
      {selectedTemplate && (
        <div className="space-y-3 border-t pt-4">
          <label className="text-sm font-medium text-gray-700">
            Custom Instructions (Optional)
          </label>
          <textarea
            placeholder="Add specific instructions for how the AI should modify this template..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full min-h-[80px] p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmSelection}
          disabled={!selectedTemplate || isGenerating}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate with Template
            </>
          )}
        </Button>
      </div>
    </div>
  )
}