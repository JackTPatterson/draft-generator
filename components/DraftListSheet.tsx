"use client"

import { useState, useEffect } from "react"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Accordion
} from "@/components/ui/accordion"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText, Search, Filter, Plus, Sparkles,
  BookOpen, Calendar, Tag, User, RefreshCw
} from "lucide-react"
import DraftAccordionItem from "./DraftAccordionItem"

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

interface EmailDraft {
  id: string
  subject: string
  content: string
  recipientEmail?: string
  recipientName?: string
  status: 'draft' | 'scheduled' | 'sent'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
  scheduledFor?: string
  tags: string[]
  templateId?: string
  templateName?: string
  citations?: Citation[]
  usedCitations?: string[]
  aiEnhanced?: boolean
}

interface DraftListSheetProps {
  trigger?: React.ReactNode
  onCreateNew?: () => void
  onEditDraft?: (draft: EmailDraft) => void
}

// Mock data for demonstration
const mockDrafts: EmailDraft[] = [
  {
    id: "1",
    subject: "Data Privacy Policy Information",
    content: "Thank you for your inquiry about our data privacy practices. I'd be happy to provide you with detailed information about how we handle and protect your data.\n\nOur platform implements comprehensive security measures [Source 1] including end-to-end encryption and multi-factor authentication. According to our data privacy policy [Source 2], we follow strict GDPR compliance standards and maintain SOC 2 Type II certification.\n\nIf you have any specific questions about our privacy practices, please don't hesitate to reach out.",
    recipientEmail: "customer@example.com",
    recipientName: "John Smith",
    status: "draft",
    priority: "normal",
    createdAt: "2025-08-01T10:30:00Z",
    updatedAt: "2025-08-01T14:15:00Z",
    tags: ["privacy", "compliance", "customer-inquiry"],
    templateName: "Privacy Response Template",
    aiEnhanced: true,
    citations: [
      {
        id: "source-1",
        label: "Source 1",
        title: "Data Privacy and Security Policy", 
        category: "Legal Documents",
        type: "document",
        relevanceScore: 0.94,
        snippet: "Our company is committed to protecting the privacy and security of customer data. This document outlines our comprehensive approach to data protection including end-to-end encryption, multi-factor authentication, and regular security audits."
      },
      {
        id: "source-2",
        label: "Source 2",
        title: "GDPR Compliance Guidelines",
        category: "Legal Documents", 
        type: "document",
        relevanceScore: 0.89,
        snippet: "We maintain strict GDPR compliance standards with SOC 2 Type II certification. All data processing follows the principles of data minimization, purpose limitation, and storage limitation."
      }
    ],
    usedCitations: ["source-1", "source-2"]
  },
  {
    id: "2", 
    subject: "Marketing Strategy Discussion",
    content: "I would like to schedule a meeting to discuss our Q2 marketing strategy and budget allocation.\n\nBased on our marketing strategy document [Source 1], we should focus on digital transformation with a 40% budget allocation for digital advertising and 25% for content creation.\n\nPlease let me know your availability for next week.",
    recipientEmail: "team@company.com",
    status: "scheduled",
    priority: "high",
    createdAt: "2025-08-01T09:00:00Z",
    updatedAt: "2025-08-01T13:45:00Z",
    scheduledFor: "2025-08-02T09:00:00Z",
    tags: ["marketing", "strategy", "budget"],
    templateName: "Meeting Request Template",
    aiEnhanced: true,
    citations: [
      {
        id: "source-3",
        label: "Source 1", 
        title: "Marketing Strategy Document",
        category: "Marketing Materials",
        type: "document",
        relevanceScore: 0.87,
        snippet: "Our marketing strategy focuses on digital transformation and customer engagement through multiple channels. Budget Allocation: Digital Advertising: 40%, Content Creation: 25%, Events and Webinars: 20%, Marketing Tools: 15%"
      }
    ],
    usedCitations: ["source-3"]
  },
  {
    id: "3",
    subject: "Customer Support Response",
    content: "Thank you for contacting our support team. We've received your inquiry and will respond within 4 hours during business hours.\n\nFor urgent issues, please call our emergency line at 1-800-555-HELP.",
    recipientEmail: "support-request@client.com",
    status: "draft", 
    priority: "urgent",
    createdAt: "2025-08-01T11:20:00Z",
    updatedAt: "2025-08-01T11:20:00Z",
    tags: ["support", "response"],
    templateName: "Support Response Template",
    aiEnhanced: false,
    citations: [],
    usedCitations: []
  }
]

export default function DraftListSheet({ 
  trigger, 
  onCreateNew,
  onEditDraft 
}: DraftListSheetProps) {
  const [drafts, setDrafts] = useState<EmailDraft[]>(mockDrafts)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [aiEnhancedFilter, setAiEnhancedFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)

  // Filter drafts based on search and filters
  const filteredDrafts = drafts.filter(draft => {
    const matchesSearch = draft.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         draft.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         draft.recipientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         draft.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || draft.status === statusFilter
    const matchesPriority = priorityFilter === "all" || draft.priority === priorityFilter
    const matchesAiEnhanced = aiEnhancedFilter === "all" || 
                             (aiEnhancedFilter === "ai-enhanced" && draft.aiEnhanced) ||
                             (aiEnhancedFilter === "manual" && !draft.aiEnhanced)

    return matchesSearch && matchesStatus && matchesPriority && matchesAiEnhanced
  })

  const handleDeleteDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  const handleSendDraft = (draft: EmailDraft) => {
    setDrafts(prev => prev.map(d => 
      d.id === draft.id 
        ? { ...d, status: 'sent' as const, updatedAt: new Date().toISOString() }
        : d
    ))
  }

  const handleDuplicateDraft = (draft: EmailDraft) => {
    const newDraft: EmailDraft = {
      ...draft,
      id: Date.now().toString(),
      subject: `Copy of ${draft.subject}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setDrafts(prev => [newDraft, ...prev])
  }

  const aiEnhancedCount = drafts.filter(d => d.aiEnhanced).length
  const citedCount = drafts.filter(d => d.citations && d.citations.length > 0).length

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            View {drafts?.length ?? 0} Drafts
          </Button>
        )}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Email Drafts
              </SheetTitle>
              <SheetDescription>
                Manage and organize your email drafts
              </SheetDescription>
            </div>
            <Button onClick={onCreateNew} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Draft
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{drafts.length}</div>
              <div className="text-xs text-gray-600">Total Drafts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{aiEnhancedCount}</div>
              <div className="text-xs text-gray-600">AI Enhanced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{citedCount}</div>
              <div className="text-xs text-gray-600">With Sources</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search drafts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={aiEnhancedFilter} onValueChange={setAiEnhancedFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ai-enhanced">AI Enhanced</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        {/* Draft List */}
        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">No drafts found</h3>
              <p className="text-sm text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Create your first email draft to get started'}
              </p>
              {!searchTerm && (
                <Button onClick={onCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Draft
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {filteredDrafts.map((draft) => (
                <DraftAccordionItem
                  key={draft.id}
                  draft={draft}
                  onEdit={onEditDraft}
                  onDelete={handleDeleteDraft}
                  onSend={handleSendDraft}
                  onDuplicate={handleDuplicateDraft}
                />
              ))}
            </Accordion>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}