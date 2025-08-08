"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { 
  Mail, Clock, User, Edit, Trash2, Send, Copy, 
  BookOpen, Sparkles, Eye, Calendar, Tag
} from "lucide-react"
import DraftCitations from "./DraftCitations"
import CitationHighlighter from "./CitationHighlighter"

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

interface DraftAccordionItemProps {
  draft: EmailDraft
  onEdit?: (draft: EmailDraft) => void
  onDelete?: (draftId: string) => void
  onSend?: (draft: EmailDraft) => void
  onDuplicate?: (draft: EmailDraft) => void
}

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-500', label: 'Low' },
  normal: { color: 'bg-blue-100 ', label: 'Normal' },
  high: { color: 'bg-orange-100 text-orange-600', label: 'High' },
  urgent: { color: 'bg-red-100 text-red-600', label: 'Urgent' }
}

const statusConfig = {
  draft: { color: 'bg-yellow-100 text-yellow-700', label: 'Draft' },
  scheduled: { color: 'bg-blue-100 text-blue-700', label: 'Scheduled' },
  sent: { color: 'bg-green-100 text-green-700', label: 'Sent' }
}

export default function DraftAccordionItem({
  draft,
  onEdit,
  onDelete,
  onSend,
  onDuplicate
}: DraftAccordionItemProps) {
  const [showFullContent, setShowFullContent] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getContentPreview = (content: string, maxLength = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <AccordionItem value={draft.id} className="border rounded-lg mb-2">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:">
        <div className="flex items-center justify-between w-full mr-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate">{draft.subject || 'No Subject'}</span>
                {draft.aiEnhanced && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>To: {draft.recipientEmail || 'Not specified'}</span>
                <span>•</span>
                <span>{formatDate(draft.updatedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={`text-xs ${statusConfig[draft.status].color}`}>
              {statusConfig[draft.status].label}
            </Badge>
            <Badge className={`text-xs ${priorityConfig[draft.priority].color}`}>
              {priorityConfig[draft.priority].label}
            </Badge>
            {draft.citations && draft.citations.length > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                <BookOpen className="w-3 h-3 mr-1" />
                {draft.usedCitations?.length || 0}/{draft.citations.length}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Draft Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-gray-500">
                <User className="w-3 h-3" />
                <span>Recipient</span>
              </div>
              <div className="font-medium">
                {draft.recipientName ? `${draft.recipientName} (${draft.recipientEmail})` : draft.recipientEmail || 'Not specified'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-gray-500">
                <Clock className="w-3 h-3" />
                <span>Last Updated</span>
              </div>
              <div className="font-medium">{formatDate(draft.updatedAt)}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-gray-500">
                <Tag className="w-3 h-3" />
                <span>Template</span>
              </div>
              <div className="font-medium">
                {draft.templateName || 'Custom draft'}
              </div>
            </div>
          </div>

          <Separator />

          {/* Email Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Email Content</h4>
              {draft.content.length > 150 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="text-xs h-6"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {showFullContent ? 'Show Less' : 'Show Full'}
                </Button>
              )}
            </div>

            <div className=" rounded-lg p-3 border">
              <div className="font-medium text-sm mb-2 text-gray-700">
                Subject: {draft.subject || 'No Subject'}
              </div>
              <div className="text-sm leading-relaxed">
                {draft.citations && draft.citations.length > 0 ? (
                  <CitationHighlighter
                    content={showFullContent ? draft.content : getContentPreview(draft.content)}
                    citations={draft.citations}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">
                    {showFullContent ? draft.content : getContentPreview(draft.content)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Citations Section */}
          {draft.citations && draft.citations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 " />
                  <h4 className="font-medium text-sm">Knowledge Sources</h4>
                  <Badge variant="secondary" className="text-xs">
                    {draft.citations.length} source{draft.citations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <DraftCitations
                  citations={draft.citations}
                  usedCitations={draft.usedCitations}
                  compact={true}
                />
              </div>
            </>
          )}

          {/* Tags */}
          {draft.tags && draft.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {draft.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={() => onSend?.(draft)}
                disabled={draft.status === 'sent'}
                className="flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                {draft.status === 'scheduled' ? 'Send Now' : 'Send'}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onEdit?.(draft)}
                className="flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onDuplicate?.(draft)}
                className="flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                Duplicate
              </Button>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDelete?.(draft.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}