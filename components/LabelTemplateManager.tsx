"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import useSWR from 'swr'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Link,
  FileText,
  Hash,
  Plus,
  Trash2,
  ArrowRight,
  Settings,
  Zap,
} from "lucide-react"

interface EmailLabel {
  id: string
  name: string
  type: string
  color: string
  email_count: number
  template_count: number
}

interface EmailTemplate {
  id: string
  name: string
  category: string
  description?: string
  usage_count: number
}

interface TemplateLabelAssociation {
  id: string
  template_id: string
  label_id: string
  priority_score: number
  auto_suggest: boolean
  auto_apply: boolean
  template: EmailTemplate
  label: EmailLabel
}

interface LabelTemplateManagerProps {
  selectedLabel?: EmailLabel
  onClose?: () => void
}

export default function LabelTemplateManager({ selectedLabel, onClose }: LabelTemplateManagerProps) {
  const [activeTab, setActiveTab] = useState("label-to-template")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [priorityScore, setPriorityScore] = useState(1)
  const [autoSuggest, setAutoSuggest] = useState(true)
  const [autoApply, setAutoApply] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch')
    return response.json()
  }

  const { data: labelsData, mutate: mutateLabels } = useSWR('/api/email-labels', fetcher)
  const { data: templatesData, mutate: mutateTemplates } = useSWR('/api/templates', fetcher)
  const { data: associationsData, mutate: mutateAssociations } = useSWR('/api/templates/labels/associations', fetcher)


  const labels: EmailLabel[] = labelsData?.labels || []
  const templates: EmailTemplate[] = templatesData?.templates || []
  const associations: TemplateLabelAssociation[] = associationsData?.associations || []

  // Filter data based on search - memoized to prevent unnecessary re-renders
  const filteredLabels = useMemo(() => 
    labels.filter(label => 
      label.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [searchTerm]
  )
  
  const filteredTemplates = useMemo(() => 
    templates.filter(template => 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase())
    ), [searchTerm]
  )

  // Get associations for a specific label - memoized
  const getAssociationsForLabel = useCallback((labelId: string) => {
    return associations.filter(assoc => assoc.label_id === labelId)
  }, [associations])

  // Get associations for a specific template - memoized
  const getAssociationsForTemplate = useCallback((templateId: string) => {
    return associations.filter(assoc => assoc.template_id === templateId)
  }, [associations])

  const handleCreateAssociation = async () => {
    try {
      const labelIds = activeTab === "label-to-template" ? [selectedLabel?.id].filter(Boolean) : selectedLabelIds
      const templateIds = activeTab === "label-to-template" ? selectedTemplateIds : selectedTemplateIds

      if (!labelIds.length || !templateIds.length) {
        toast.error('Please select both labels and templates')
        return
      }

      const associations = []
      for (const labelId of labelIds) {
        for (const templateId of templateIds) {
          associations.push({
            label_id: labelId,
            template_id: templateId,
            priority_score: priorityScore,
            auto_suggest: autoSuggest,
            auto_apply: autoApply,
          })
        }
      }

      const response = await fetch('/api/templates/labels/associations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ associations }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create associations')
      }

      toast.success('Template-label associations created successfully!')
      setIsDialogOpen(false)
      setSelectedTemplateIds([])
      setSelectedLabelIds([])
      setPriorityScore(1)
      setAutoSuggest(true)
      setAutoApply(false)
      mutateAssociations()
      mutateLabels()
      mutateTemplates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create associations')
    }
  }

  const handleDeleteAssociation = async (associationId: string) => {
    try {
      const response = await fetch(`/api/templates/labels/associations?id=${associationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete association')
      }

      toast.success('Association deleted successfully!')
      mutateAssociations()
      mutateLabels()
      mutateTemplates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete association')
    }
  }

  const handleToggleAutoSuggest = async (associationId: string, newValue: boolean) => {
    try {
      const response = await fetch('/api/templates/labels/associations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: associationId,
          auto_suggest: newValue,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update association')
      }

      mutateAssociations()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update association')
    }
  }

  const handleToggleAutoApply = async (associationId: string, newValue: boolean) => {
    try {
      const response = await fetch('/api/templates/labels/associations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: associationId,
          auto_apply: newValue,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update association')
      }

      mutateAssociations()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update association')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Label-Template Associations</h2>
          <p className="text-sm text-gray-500">
            Connect labels to templates for automated email response suggestions
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Association
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" key="label-association-modal">
            <DialogHeader>
              <DialogTitle>Create Label-Template Association</DialogTitle>
              <DialogDescription>
                Associate labels with templates to automatically suggest responses for emails with those labels.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="label-to-template">
                  {selectedLabel ? `${selectedLabel.name} → Templates` : 'Label → Templates'}
                </TabsTrigger>
                <TabsTrigger value="bulk-associations">Bulk Associations</TabsTrigger>
              </TabsList>

              <TabsContent value="label-to-template" className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">
                    Selected Label: {selectedLabel ? (
                      <Badge style={{ backgroundColor: selectedLabel.color, color: 'white' }}>
                        {selectedLabel.name}
                      </Badge>
                    ) : 'None'}
                  </h4>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Select Templates</label>
                  <Input
                    key="search-templates-input"
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-3"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                    {filteredTemplates.map(template => (
                      <div key={template.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`template-${template.id}`}
                          checked={selectedTemplateIds.includes(template.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTemplateIds([...selectedTemplateIds, template.id])
                            } else {
                              setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== template.id))
                            }
                          }}
                        />
                        <label htmlFor={`template-${template.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{template.name}</span>
                            <Badge variant="outline">{template.category}</Badge>
                          </div>
                          {template.description && (
                            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bulk-associations" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Labels</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                      {filteredLabels.map(label => (
                        <div key={label.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`label-${label.id}`}
                            checked={selectedLabelIds.includes(label.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLabelIds([...selectedLabelIds, label.id])
                              } else {
                                setSelectedLabelIds(selectedLabelIds.filter(id => id !== label.id))
                              }
                            }}
                          />
                          <label htmlFor={`label-${label.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="font-medium">{label.name}</span>
                              <Badge variant="outline">{label.type}</Badge>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Templates</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                      {filteredTemplates.map(template => (
                        <div key={template.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`bulk-template-${template.id}`}
                            checked={selectedTemplateIds.includes(template.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTemplateIds([...selectedTemplateIds, template.id])
                              } else {
                                setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== template.id))
                              }
                            }}
                          />
                          <label htmlFor={`bulk-template-${template.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{template.name}</span>
                              <Badge variant="outline">{template.category}</Badge>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Association Settings</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Priority Score</label>
                  <Input
                    key="priority-score-input"
                    type="number"
                    min="1"
                    max="10"
                    value={priorityScore}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '') {
                        setPriorityScore(1)
                      } else {
                        const numValue = parseInt(value)
                        if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                          setPriorityScore(numValue)
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher numbers = higher priority</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-suggest"
                      checked={autoSuggest}
                      onCheckedChange={(checked) => setAutoSuggest(checked === true)}
                    />
                    <label htmlFor="auto-suggest" className="text-sm font-medium">
                      Auto-suggest
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">Suggest this template for emails with this label</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-apply"
                      checked={autoApply}
                      onCheckedChange={(checked) => setAutoApply(checked === true)}
                    />
                    <label htmlFor="auto-apply" className="text-sm font-medium">
                      Auto-apply
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">Automatically apply this template (use carefully)</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssociation}>
                Create Association
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Associations */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Current Associations</h3>
        
        {selectedLabel ? (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedLabel.color }}
              />
              {selectedLabel.name} Templates
            </h4>
            <div className="grid gap-3">
              {getAssociationsForLabel(selectedLabel.id).map(association => (
                <Card key={association.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="font-medium">{association.template.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="outline">{association.template.category}</Badge>
                            <span>Priority: {association.priority_score}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={association.auto_suggest}
                            onCheckedChange={(checked) => 
                              handleToggleAutoSuggest(association.id, checked === true)
                            }
                          />
                          <span className="text-xs">Suggest</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={association.auto_apply}
                            onCheckedChange={(checked) => 
                              handleToggleAutoApply(association.id, checked === true)
                            }
                          />
                          <span className="text-xs">Auto-apply</span>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAssociation(association.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {getAssociationsForLabel(selectedLabel.id).length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No templates associated with this label yet.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {associations.map(association => (
              <Card key={association.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: association.label.color }}
                        />
                        <span className="font-medium">{association.label.name}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{association.template.name}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Priority {association.priority_score}</Badge>
                      {association.auto_suggest && (
                        <Badge variant="secondary">Auto-suggest</Badge>
                      )}
                      {association.auto_apply && (
                        <Badge variant="default">Auto-apply</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAssociation(association.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {associations.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No label-template associations created yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}