"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import useSWR from 'swr'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Hash,
  Search,
  Filter,
  Mail,
  FileText,
  Palette,
  Link,
  StarIcon,
  Sparkles,
  Loader2, Tag,
} from "lucide-react"
import LabelTemplateManager from "@/components/LabelTemplateManager"

interface EmailLabel {
  id: string
  user_id: string
  name: string
  description?: string
  type: 'system' | 'category' | 'priority' | 'project' | 'custom'
  color: string
  icon?: string
  n8n_trigger_keywords: string[]
  n8n_sender_patterns: string[]
  n8n_subject_patterns: string[]
  sort_order: number
  is_active: boolean
  is_system: boolean
  email_count: number
  template_count: number
  created_at: string
  updated_at: string
}

interface EmailTemplate {
  id: string
  name: string
  category: string
  description?: string
}

const labelTypeOptions = [
  { value: 'custom', label: 'Custom' },
  { value: 'category', label: 'Category' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
]

const colorOptions = [
  '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16'
]

export default function LabelsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [selectedLabel, setSelectedLabel] = useState<EmailLabel | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deleteAlertLabel, setDeleteAlertLabel] = useState<EmailLabel | null>(null)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [selectedLabelForTemplates, setSelectedLabelForTemplates] = useState<EmailLabel | null>(null)
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'custom' as EmailLabel['type'],
    color: '#6B7280',
    icon: '',
    n8n_trigger_keywords: [] as string[],
    n8n_sender_patterns: [] as string[],
    n8n_subject_patterns: [] as string[],
  })

  // Temporary string states for array inputs
  const [keywordsInput, setKeywordsInput] = useState('')
  const [senderPatternsInput, setSenderPatternsInput] = useState('')
  const [subjectPatternsInput, setSubjectPatternsInput] = useState('')

  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch')
    return response.json()
  }

  const { data: labelsData, mutate: mutateLabels } = useSWR('/api/email-labels', fetcher)
  const { data: templatesData } = useSWR('/api/templates', fetcher)
  
  const labels: EmailLabel[] = labelsData?.labels || []
  const templates: EmailTemplate[] = templatesData?.templates || []

  const filteredLabels = useMemo(() => labels.filter(label => {
    const matchesSearch = label.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         label.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || label.type === filterType
    return matchesSearch && matchesType
  }), [labels, searchTerm, filterType])

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      type: 'custom',
      color: '#6B7280',
      icon: '',
      n8n_trigger_keywords: [],
      n8n_sender_patterns: [],
      n8n_subject_patterns: [],
    })
    setKeywordsInput('')
    setSenderPatternsInput('')
    setSubjectPatternsInput('')
  }, [])

  const openEditDialog = (label: EmailLabel) => {
    setSelectedLabel(label)
    setFormData({
      name: label.name,
      description: label.description || '',
      type: label.type,
      color: label.color,
      icon: label.icon || '',
      n8n_trigger_keywords: label.n8n_trigger_keywords,
      n8n_sender_patterns: label.n8n_sender_patterns,
      n8n_subject_patterns: label.n8n_subject_patterns,
    })
    setKeywordsInput(label.n8n_trigger_keywords?.join(', '))
    setSenderPatternsInput(label.n8n_sender_patterns?.join(', '))
    setSubjectPatternsInput(label.n8n_subject_patterns?.join(', '))
    setIsEditDialogOpen(true)
  }

  const handleCreateLabel = async () => {
    try {
      const labelData = {
        ...formData,
        n8n_trigger_keywords: keywordsInput ? keywordsInput.split(',').map(k => k.trim()).filter(k => k) : [],
        n8n_sender_patterns: senderPatternsInput ? senderPatternsInput.split(',').map(p => p.trim()).filter(p => p) : [],
        n8n_subject_patterns: subjectPatternsInput ? subjectPatternsInput.split(',').map(p => p.trim()).filter(p => p) : [],
      }

      const response = await fetch('/api/email-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create label')
      }

      toast.success('Label created successfully!')
      setIsCreateDialogOpen(false)
      resetForm()
      mutateLabels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create label')
    }
  }

  const handleGenerateKeywords = async () => {
    try {
      setIsGeneratingKeywords(true)
      const response = await fetch(`http://localhost:5678/webhook-test/675d72e7-b862-4aa2-be34-0f2acaccc812`, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const error = data;
        throw new Error(error.error || 'Failed to create keywords')
      }

      setFormData({ ...formData, n8n_trigger_keywords: data.output })
      setKeywordsInput(data.output)

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create keywords')
    } finally {
      setIsGeneratingKeywords(false)
    }
  }

  const handleUpdateLabel = async () => {
    if (!selectedLabel) return

    try {
      const labelData = {
        id: selectedLabel.id,
        ...formData,
        n8n_trigger_keywords: keywordsInput ? keywordsInput.split(',').map(k => k.trim()).filter(k => k) : [],
        n8n_sender_patterns: senderPatternsInput ? senderPatternsInput.split(',').map(p => p.trim()).filter(p => p) : [],
        n8n_subject_patterns: subjectPatternsInput ? subjectPatternsInput.split(',').map(p => p.trim()).filter(p => p) : [],
      }

      const response = await fetch('/api/email-labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update label')
      }

      toast.success('Label updated successfully!')
      setIsEditDialogOpen(false)
      setSelectedLabel(null)
      resetForm()
      mutateLabels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update label')
    }
  }

  const handleDeleteLabel = async (label: EmailLabel) => {
    try {
      const response = await fetch(`/api/email-labels?id=${label.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete label')
      }

      toast.success('Label deleted successfully!')
      setDeleteAlertLabel(null)
      mutateLabels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete label')
    }
  }

  const LabelFormFields = useMemo(() => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input
          key="label-name-input"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter label name"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          key="label-description-input"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={formData.type} onValueChange={(value: EmailLabel['type']) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labelTypeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Color</label>
          <div className="flex gap-1 flex-wrap">
            {colorOptions.map(color => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Automation Triggers</h4>
        
        <div>
          <label className="text-xs text-gray-500">Trigger Keywords</label>
          <div className={'flex space-x-2'}>
            <Input
                key="keywords-input"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="urgent, important, action required (comma separated)"
            />
            <Button 
              onClick={handleGenerateKeywords} 
              variant="outline" 
              className={'aspect-square'} 
              size={'icon'}
              disabled={isGeneratingKeywords || !formData.name.trim()}
            >
              {isGeneratingKeywords ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>

          </div>

        </div>

        <div>
          <label className="text-xs text-gray-500">Sender Patterns</label>
          <Input
            key="sender-patterns-input"
            value={senderPatternsInput}
            onChange={(e) => setSenderPatternsInput(e.target.value)}
            placeholder="*@company.com, support@* (comma separated)"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Subject Patterns</label>
          <Input
            key="subject-patterns-input"
            value={subjectPatternsInput}
            onChange={(e) => setSubjectPatternsInput(e.target.value)}
            placeholder="[URGENT], Re:, Fwd: (comma separated)"
          />
        </div>
      </div>
    </div>
  ), [formData, keywordsInput, senderPatternsInput, subjectPatternsInput, isGeneratingKeywords])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gmail Labels</h1>
        <p className="text-gray-500">Manage your email labels and connect them to templates for automated responses.</p>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              key="search-labels-input"
              placeholder="Search labels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Create Label
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" key="create-label-modal">
            <DialogHeader>
              <DialogTitle>Create New Label</DialogTitle>
              <DialogDescription>
                Create a new label to categorize your emails and connect them to templates.
              </DialogDescription>
            </DialogHeader>
            {LabelFormFields}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLabel} disabled={!formData.name.trim()}>
                Create Label
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Labels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLabels.map((label) => (
          <Card key={label.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <CardTitle className="text-lg">{label.name}</CardTitle>
                  {label.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(label)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setSelectedLabelForTemplates(label)
                      setShowTemplateManager(true)
                    }}>
                      <Link className="w-4 h-4 mr-2" />
                      Manage Templates
                    </DropdownMenuItem>
                    {!label.is_system && (
                      <DropdownMenuItem 
                        onClick={() => setDeleteAlertLabel(label)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Badge variant="outline" className="text-xs">
                  {label.type}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {label.description && (
                <p className="text-sm text-gray-500 mb-3">{label.description}</p>
              )}
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {label.email_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {label.template_count}
                  </span>
                </div>
                
                {!label.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>

              {/* Automation indicators */}
              {(label.n8n_trigger_keywords?.length > 0 ||
                label.n8n_sender_patterns?.length > 0 ||
                label.n8n_subject_patterns?.length > 0) && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1 text-xs ">
                    <Tag className="w-3 h-3" />
                    Automation triggers configured
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredLabels.length === 0 && (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' ? 'No labels found' : 'No labels yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Create your first label to start organizing your emails.'}
          </p>
          {!searchTerm && filterType === 'all' && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Label
            </Button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl" key="edit-label-modal">
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>
              Update your label settings and automation triggers.
            </DialogDescription>
          </DialogHeader>
          {LabelFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateLabel} disabled={!formData.name.trim()}>
              Update Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAlertLabel} onOpenChange={() => setDeleteAlertLabel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the label "{deleteAlertLabel?.name}"? 
              This action cannot be undone and will remove all associations with emails and templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteAlertLabel && handleDeleteLabel(deleteAlertLabel)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Manager Modal */}
      <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Template Associations - {selectedLabelForTemplates?.name}
            </DialogTitle>
            <DialogDescription>
              Connect this label with email templates for automated response suggestions.
            </DialogDescription>
          </DialogHeader>
          <LabelTemplateManager 
            selectedLabel={selectedLabelForTemplates || undefined}
            onClose={() => setShowTemplateManager(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}