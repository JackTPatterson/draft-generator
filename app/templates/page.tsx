"use client"

import { AuthGuard } from "@/components/AuthGuard"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Plus, Search, Edit, Trash2, Copy, Mail, FileText, Star, MoreHorizontal, ArrowLeft, Sparkles, Brain, GripVertical, X, Palette, Settings } from "lucide-react"
import Link from "next/link"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Spinner from "@/components/Spinner";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";

// Draggable Variable Component for Template Variables List
function DraggableVariable({ id, name, type = 'custom' }: { id: string, name: string, type?: 'custom' | 'system' }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const variableText = `{{${name}}}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 h-10 p-2 rounded border cursor-grab hover: ${
        type === 'system' ? 'bg-blue-50 border-blue-200' : 'bg-gray-100 border-gray-200'
      }`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4 text-gray-400" />
      <span className={`text-sm text-nowrap font-mono ${type === 'system' ? 'text-blue-700' : 'text-gray-700'}`}>
        {variableText}
      </span>
      {type === 'system' && (
        <Badge variant="outline" className="text-xs">System</Badge>
      )}
    </div>
  )
}

// Syntax Highlighting Component
function HighlightedTextarea({ 
  id, 
  value, 
  onChange, 
  placeholder, 
  className,
  textareaRef
}: { 
  id: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  placeholder?: string,
  className?: string,
  textareaRef?: (ref: HTMLTextAreaElement | null) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  })

  // Function to highlight variables in the text
  const highlightVariables = (text: string) => {
    if (!text) return <span className="text-gray-400">{placeholder}</span>
    
    // Split text by variable pattern {{variable_name}}
    const parts = text.split(/(\{\{[^}]+\}\})/g)
    
    return parts.map((part, index) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        // This is a variable
        const variableName = part.slice(2, -2) // Remove {{ and }}
        return (
          <span 
            key={index} 
            className="bg-blue-100 text-blue-800 px-1 rounded font-mono text-sm font-medium"
          >
            {part}
          </span>
        )
      } else {
        // Regular text
        return <span key={index}>{part}</span>
      }
    })
  }

  return (
    <div 
      ref={setNodeRef}
      className={`relative ${isOver ? 'ring-2 ring-[#25206b] ring-opacity-50' : ''}`}
    >
      {/* Actual textarea with visible text but highlighted variables */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${className} ${isOver ? 'border-[#25206b]' : ''}`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
          }}
        />

        {/* Variable counter - positioned outside textarea */}
        {value && (
          <div className="absolute -top-8 right-0 text-xs  pointer-events-none bg-white px-2 py-1 rounded border">
            Variables: {(value.match(/\{\{[^}]+\}\}/g) || []).length}
          </div>
        )}
      </div>

      {isOver && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-50 border-2 border-[#25206b] border-dashed rounded-md flex items-center justify-center pointer-events-none z-10">
          <span className="text-blue-700 font-medium">Drop variable here</span>
        </div>
      )}
    </div>
  )
}

// Droppable Textarea Component (keeping the original as fallback)
function DroppableTextarea({ 
  id, 
  value, 
  onChange, 
  placeholder, 
  className,
  textareaRef
}: { 
  id: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  placeholder?: string,
  className?: string,
  textareaRef?: (ref: HTMLTextAreaElement | null) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  })

  return (
    <div 
      ref={setNodeRef}
      className={`relative ${isOver ? 'ring-2 ring-[#25206b] ring-opacity-50' : ''}`}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} ${isOver ? 'border-[#25206b]' : ''}`}
      />
      {isOver && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-50 border-2 border-[#25206b] border-dashed rounded-md flex items-center justify-center pointer-events-none">
          <span className="text-blue-700 font-medium">Drop variable here</span>
        </div>
      )}
    </div>
  )
}

// Draggable Variable Component
function SortableVariable({ id, name, onRemove }: { id: string, name: string, onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-gray-100 rounded border"
    >
      <div {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      <span className="flex-1 text-sm font-mono">[{name}]</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(id)}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  )
}

// Template Form Component
function TemplateForm({ 
  template, 
  onSave, 
  onCancel, 
  categories 
}: { 
  template?: any, 
  onSave: (data: any) => void, 
  onCancel: () => void,
  categories: any[]
}) {
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

  const [variables, setVariables] = useState<{ id: string, name: string }[]>(
    template?.variables?.map((v: string, i: number) => ({ id: `var-${i}`, name: v })) || []
  )
  const [newVariable, setNewVariable] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bodyTextareaRef, setBodyTextareaRef] = useState<HTMLTextAreaElement | null>(null)

  // AI Instructions state - individual instructions for each variable
  const [aiInstructions, setAiInstructions] = useState<{ [key: string]: string }>(() => {
    // Initialize empty first
    return Array.from({ length: 10 }, (_, i) => ({
      [`instructions${i + 1}`]: ""
    })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
  })

  // Update aiInstructions when template changes
  useEffect(() => {
    if (template?.template_ai_instructions && Array.isArray(template.template_ai_instructions)) {
      const instructionsObj: { [key: string]: string } = {}
      template.template_ai_instructions.forEach((instruction: string, index: number) => {
        instructionsObj[`instructions${index + 1}`] = instruction
      })
      // Fill remaining slots with empty strings
      for (let i = template.template_ai_instructions.length + 1; i <= 10; i++) {
        instructionsObj[`instructions${i}`] = ""
      }
      setAiInstructions(instructionsObj)
    } else {
      // Reset to empty if no template or no instructions
      const emptyInstructions = Array.from({ length: 10 }, (_, i) => ({
        [`instructions${i + 1}`]: ""
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
      setAiInstructions(emptyInstructions)
    }
  }, [template])

  // Update formData when template changes
  useEffect(() => {
    setFormData({
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
  }, [template])

  // Update variables when template changes
  useEffect(() => {
    setVariables(template?.variables?.map((v: string, i: number) => ({ id: `var-${i}`, name: v })) || [])
  }, [template])

  // System variables that are always available
  const systemVariables = [
    { id: 'sys-to-email', name: 'to-email', type: 'system' as const },
    { id: 'sys-to-name', name: 'to-name', type: 'system' as const },
    { id: 'sys-from-email', name: 'from-email', type: 'system' as const },
    { id: 'sys-from-name', name: 'from-name', type: 'system' as const },
    { id: 'sys-subject', name: 'subject', type: 'system' as const },
    { id: 'sys-date', name: 'date', type: 'system' as const },
    { id: 'sys-time', name: 'time', type: 'system' as const },
  ]

  // AI instruction variables
  const instructionVariables = Array.from({ length: 10 }, (_, i) => ({
    id: `inst-${i + 1}`,
    name: `instructions${i + 1}`,
    type: 'custom' as const
  }))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const addVariable = () => {
    if (!newVariable.trim()) return
    const id = `var-${Date.now()}`
    setVariables([...variables, { id, name: newVariable.trim().toUpperCase() }])
    setNewVariable("")
  }

  const removeVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    
    if (!over) return

    // If dropping over the textarea (body_template), insert the variable
    if (over.id === 'body-template-droppable') {
      const draggedItem = [
        ...systemVariables,
        ...instructionVariables,
        ...variables.map(v => ({ ...v, type: 'custom' as const }))
      ].find(item => item.id === active.id)
      
      if (draggedItem && bodyTextareaRef) {
        const variableText = `{{${draggedItem.name}}}`
        const currentValue = formData.body_template
        const cursorPosition = bodyTextareaRef.selectionStart || currentValue.length
        
        const newValue = 
          currentValue.slice(0, cursorPosition) + 
          variableText + 
          currentValue.slice(cursorPosition)
        
        setFormData({ ...formData, body_template: newValue })
        
        // Set cursor position after the inserted variable
        setTimeout(() => {
          if (bodyTextareaRef) {
            bodyTextareaRef.selectionStart = cursorPosition + variableText.length
            bodyTextareaRef.selectionEnd = cursorPosition + variableText.length
            bodyTextareaRef.focus()
          }
        }, 0)
      }
      return
    }

    // Original drag logic for reordering custom variables
    if (active.id !== over.id) {
      setVariables((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = () => {
    // Convert individual instruction textareas to template_ai_instructions array
    // Map from aiInstructions object (instructions1, instructions2, etc.) to array
    const templateAiInstructionsArray = Array.from({ length: 10 }, (_, i) => {
      const instructionKey = `instructions${i + 1}`
      return aiInstructions[instructionKey] || ""
    }).filter(instruction => instruction.trim().length > 0)

    const data = {
      ...formData,
      ai_instructions: formData.ai_instructions, // Keep as text for general instructions
      template_ai_instructions: templateAiInstructionsArray, // Use individual instruction textareas
      variables: variables.map(v => v.name),
      tags: formData.tags.split(",").map((tag: any) => tag.trim()).filter(Boolean),
      ai_instruction_details: aiInstructions
    }
    onSave(data)
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Basic Information */}
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

        {/* Template Type and Tone */}
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

        {/* Subject Template */}
        <div>
          <Label htmlFor="subject_template">Subject Template</Label>
          <Input
            id="subject_template"
            value={formData.subject_template}
            onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
            placeholder="e.g., Re: {{subject}} - Response Required"
          />
        </div>

        {/* Body Template with Variable Panels */}
        <div className="">
          {/* Variable Panels */}

          {/* Body Template */}
          <div className="col-span-3">
            <Label htmlFor="body_template">Email Body Template *</Label>
            <p className="text-xs text-gray-500 mb-2">
              Drag variables from the left panel into the template. Use {`{{variable_name}}`} syntax.
            </p>
            <HighlightedTextarea
              id="body-template-droppable"
              value={formData.body_template}
              onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
              placeholder="Use {{variable_name}} for dynamic content. Drag variables from the left panel..."
              className="min-h-[300px]"
              textareaRef={setBodyTextareaRef}
            />
          </div>
          <div className="gap-2 mt-2 flex overflow-x-auto">
            {systemVariables.map((variable) => (
                <DraggableVariable
                    key={variable.id}
                    id={variable.id}
                    name={variable.name}
                    type={variable.type}
                />
            ))}
          </div>
          <div className="gap-2 mt-2 flex overflow-x-auto">
            {instructionVariables.map((variable) => (
                <DraggableVariable
                    key={variable.id}
                    id={variable.id}
                    name={variable.name}
                    type={variable.type}
                />
            ))}
          </div>
        </div>

        {/* Individual AI Instructions for Each Variable */}
        <div>
          <Label className="text-lg font-medium">AI Instructions for Variables</Label>
          <p className="text-sm text-gray-500 mb-4">
            Define specific AI instructions for each {`{{instructions1}}, {{instructions2}}, etc.`} variable in your template.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 10 }, (_, i) => {
              const instructionKey = `instructions${i + 1}`
              return (
                <div key={instructionKey} className="space-y-2">
                  <Label htmlFor={instructionKey} className="text-sm font-medium text-purple-700">
                    {`{{${instructionKey}}}`}
                  </Label>
                  <Textarea
                    id={instructionKey}
                    value={aiInstructions[instructionKey] || ""}
                    onChange={(e) => setAiInstructions({
                      ...aiInstructions,
                      [instructionKey]: e.target.value
                    })}
                    placeholder={`AI instructions for {{${instructionKey}}} - e.g., "Be formal and professional when discussing pricing"`}
                    className="min-h-[80px] text-sm"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* General AI Instructions */}
        <div>
          <Label htmlFor="ai_instructions">General AI Instructions</Label>
          <p className="text-xs text-gray-500 mb-2">
            Overall instructions that apply to the entire template.
          </p>
          <Textarea
            id="ai_instructions"
            value={formData.ai_instructions}
            onChange={(e) => setFormData({ ...formData, ai_instructions: e.target.value })}
            placeholder="Be professional and friendly. Include relevant details from the email."
            className="min-h-[100px]"
          />
        </div>


        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>
            {template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white border border-gray-300 rounded px-3 py-2 shadow-lg">
            <span className="text-sm font-mono">
              {`{{${[...systemVariables, ...instructionVariables, ...variables.map(v => ({ ...v, type: 'custom' as const }))]
                  .find(item => item.id === activeId)?.name || ''}}}`}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([
    { name: "General", color: "#6B7280", icon: "mail" },
    { name: "Finance", color: "#10B981", icon: "dollar-sign" },
    { name: "Business Development", color: "#3B82F6", icon: "handshake" },
    { name: "Customer Support", color: "#F59E0B", icon: "headphones" },
    { name: "HR", color: "#8B5CF6", icon: "users" },
    { name: "Marketing", color: "#EF4444", icon: "megaphone" }
  ])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")

  // Load templates and categories
  useEffect(() => {
    loadTemplates()
    loadCategories()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/template-categories')
      const data = await response.json()
      if (data.categories?.length > 0) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const handleCreateTemplate = async (templateData: any) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setTemplates([data.template, ...templates])
        setShowCreateDialog(false)
      }
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  const handleUpdateTemplate = async (templateData: any) => {
    try {
      const response = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setTemplates(templates.map(t => t.id === editingTemplate.id ? data.template : t))
        setEditingTemplate(null)
      }
    } catch (error) {
      console.error('Error updating template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== templateId))
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleDuplicateTemplate = async (template: any) => {
    const duplicatedTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined
    }
    await handleCreateTemplate(duplicatedTemplate)
  }

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || selectedCategory === "__all__" || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <Spinner/>
          <p className="text-gray-500">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen ">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Inbox
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8  rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Fluxyn</span>
              </div>
            </div>
            <Sheet open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </SheetTrigger>
              <SheetContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Create New Template</SheetTitle>
                  <SheetDescription>
                    Build a reusable email template with variables and AI instructions
                  </SheetDescription>
                </SheetHeader>
                <TemplateForm 
                  categories={categories}
                  onSave={handleCreateTemplate}
                  onCancel={() => setShowCreateDialog(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Templates</h1>
          <p className="text-gray-500">Create and manage reusable email templates for consistent communication</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search templates..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.name} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => {
            const sorted = [...templates].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
            setTemplates(sorted)
          }}>
            Most Used
          </Button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {template.tone && (
                      <Badge variant="outline" className="text-xs">
                        {template.tone}
                      </Badge>
                    )}
                    <div className="relative">
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  {template.category && (
                    <Badge 
                      variant="secondary" 
                      style={{ 
                        backgroundColor: categories.find(c => c.name === template.category)?.color + '20',
                        color: categories.find(c => c.name === template.category)?.color 
                      }}
                    >
                      {template.category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {template.type || 'reply'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className=" rounded-lg p-3 mb-4">
                  <div className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap">
                    {template.body_template || template.content}
                  </div>
                </div>
                
                {/* Variables */}
                {template.variables && template.variables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 3).map((variable: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs font-mono">
                          [{variable}]
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Tags */}
                {template.tags && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 3).map((tag: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {template.updated_at ? 
                      new Date(template.updated_at).toLocaleDateString() : 
                      'Recently created'
                    }
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{template.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || (selectedCategory && selectedCategory !== "__all__") ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || (selectedCategory && selectedCategory !== "__all__") ? 
                'Try adjusting your search or filters' : 
                'Create your first email template to get started'
              }
            </p>
            {!searchTerm && (!selectedCategory || selectedCategory === "__all__") && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Sheet open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <SheetContent className=" overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit Template</SheetTitle>
              <SheetDescription>
                Update your email template with new content and settings
              </SheetDescription>
            </SheetHeader>
            <TemplateForm 
              template={editingTemplate}
              categories={categories}
              onSave={handleUpdateTemplate}
              onCancel={() => setEditingTemplate(null)}
            />
          </SheetContent>
        </Sheet>
      )}
      </div>
    </AuthGuard>
  )
}
