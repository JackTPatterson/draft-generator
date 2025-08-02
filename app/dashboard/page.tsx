"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from 'swr'
import { motion } from "framer-motion"
import { toast } from "sonner"
import { getWebSocketClient } from "@/lib/websocket-client"

interface EmailExecution {
  id: string
  gmail_id: string
  thread_id: string
  execution_status: string
  processed_at: Date | null
  created_at: Date
  updated_at: Date
  drafts: EmailDraft[]
}

interface EmailWithExecution {
  id: number
  gmail_id?: string
  thread_id?: string
  from: string
  email: string
  subject: string
  preview: string
  time: string
  important: boolean
  unread: boolean
  recipients: string[]
  cc: string[]
  content: string
  attachments: Array<{ name: string; size: string }>
  execution?: EmailExecution
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Mail,
  Search,
  Star,
  Archive,
  Trash2,
  Send,
  Paperclip,
  Sparkles,
  Settings,
  FileText,
  Brain,
  ChevronLeft,
  ChevronRight,
  Download, ArrowDownIcon, ChevronDown, Loader2,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator,
  DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {DialogBody} from "next/dist/client/components/react-dev-overlay/ui/components/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {EmailDraft} from "@/lib/database";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {SafeHtmlRenderer} from "@/components/SafeHtmlRenderer";
import Spinner from "@/components/Spinner";
import SourceBadges from "@/components/SourceBadges";
import TemplateSelector from "@/components/TemplateSelector";
import {Progress} from "@/components/ui/progress";


export default function Dashboard() {
  const [selectedEmail, setSelectedEmail] = useState(0)
  const [showDraft, setShowDraft] = useState(false)
  const [draftContent, setDraftContent] = useState("")
  const [wsConnected, setWsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isDraftGenerating, setIsDraftGenerating] = useState(false)
  const [draftGenerationStatus, setDraftGenerationStatus] = useState<string>('')
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null)
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>('item-1')
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)

  // SWR fetcher function
  const fetcher = async (url: string) => {
    const response = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' }
    })
    if (!response.ok) {
      throw new Error('Failed to fetch emails')
    }
    return response.json()
  }

  // Use SWR for data fetching
  const { data: emails = [], error, isLoading: loading, mutate } = useSWR<EmailWithExecution[]>(
    '/api/emails',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      fallbackData: [],
      onError: (error) => {
        console.error('SWR fetch error:', error)
      },
      onSuccess: () => {
        setLastUpdate(new Date())
      }
    }
  )

  console.log(emails)

  // Function to refresh emails (for manual refresh)
  const refreshEmails = useCallback(() => {
    mutate()
  }, [mutate])

  // WebSocket setup for real-time updates
  useEffect(() => {
    const wsClient = getWebSocketClient({
      onExecutionUpdate: async (update) => {
        console.log('Received execution update:', update)
        
        // Update the specific email execution status
        // Handle both direct updates and Redis message wrapper format
        // Extract the actual execution update data, handling message wrapper
        const executionUpdate = (update as any).type === 'execution_update' ? (update as any) : update
        
        // Check if this email exists in current list
        const currentEmails = emails || []
        const existingEmail = currentEmails.find(email => 
          email.execution?.id === executionUpdate.id ||
          email.gmail_id === executionUpdate.gmail_id ||
          email.thread_id === executionUpdate.thread_id
        )
        
        if (existingEmail) {
          // Update existing email execution status
          console.log('Updating existing email execution status')
          mutate((currentEmails: EmailWithExecution[] = []) => 
            currentEmails.map(email => {
              // Match by execution id, gmail_id, or thread_id
              const matches = email.execution?.id === executionUpdate.id ||
                             email.gmail_id === executionUpdate.gmail_id ||
                             email.thread_id === executionUpdate.thread_id
              
              if (matches) {
                return {
                  ...email,
                  execution: email.execution ? {
                    ...email.execution,
                    execution_status: executionUpdate.execution_status,
                    processed_at: executionUpdate.processed_at ? new Date(executionUpdate.processed_at) : null,
                    updated_at: new Date()
                  } : {
                    id: executionUpdate.id,
                    gmail_id: executionUpdate.gmail_id || email.gmail_id,
                    thread_id: executionUpdate.thread_id || email.thread_id,
                    execution_status: executionUpdate.execution_status,
                    processed_at: executionUpdate.processed_at ? new Date(executionUpdate.processed_at) : null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    drafts: []
                  }
                }
              }
              return email
            }), 
            false // Don't revalidate immediately, just update cache
          )
        } else if (executionUpdate.gmail_id) {
          // Fetch new email by gmail_id and add to list
          console.log('Fetching new email for gmail_id:', executionUpdate.gmail_id)
          try {
            const response = await fetch(`/api/gmail/${executionUpdate.gmail_id}`)
            if (response.ok) {
              const newEmail = await response.json()
              console.log('Successfully fetched new email:', newEmail.subject)
              
              // Add execution info to the new email
              newEmail.execution = {
                id: executionUpdate.id,
                gmail_id: executionUpdate.gmail_id,
                thread_id: executionUpdate.thread_id,
                execution_status: executionUpdate.execution_status,
                processed_at: executionUpdate.processed_at ? new Date(executionUpdate.processed_at) : null,
                created_at: new Date(),
                updated_at: new Date(),
                drafts: []
              }
              
              // Add to the beginning of the list (most recent first)
              mutate((currentEmails: EmailWithExecution[] = []) => {
                // Check for duplicates before adding
                const isDuplicate = currentEmails.some(email => 
                  email.gmail_id === newEmail.gmail_id ||
                  email.thread_id === newEmail.thread_id
                )
                
                if (!isDuplicate) {
                  return [newEmail, ...currentEmails]
                }
                return currentEmails
              }, false)
              
              console.log('New email added to dashboard')
            } else {
              console.error('Failed to fetch new email:', response.status, response.statusText)
            }
          } catch (fetchError) {
            console.error('Error fetching new email:', fetchError)
          }
        } else {
          console.log('Execution update without existing email or gmail_id, skipping')
        }
        
        setLastUpdate(new Date())
        
        // Clear loading state when draft generation completes
        if (pendingDraftId && (executionUpdate.execution_status === 'completed' || executionUpdate.execution_status === 'failed')) {
          setIsDraftGenerating(false)
          setDraftGenerationStatus('')
          setPendingDraftId(null)
          
          // Refresh email data to get the latest drafts
          mutate()
          
          // Show completion notification and set active accordion to newest draft
          if (executionUpdate.execution_status === 'completed') {
            setActiveAccordionItem('item-0')
            toast.success('✨ AI draft completed successfully!', {
              id: 'draft-generation',
              description: 'Your AI-generated response is ready to review.'
            })
          } else if (executionUpdate.execution_status === 'failed') {
            toast.error('Draft generation failed', {
              id: 'draft-generation',
              description: 'There was an issue generating your draft. Please try again.'
            })
          }
        }
      },
      onConnect: () => {
        console.log('WebSocket connected')
        setWsConnected(true)
        // Only show success if we were previously disconnected
        if (!wsConnected) {
          toast.success('🔗 Real-time updates connected', {
            description: 'You\'ll receive live notifications for draft updates.'
          })
        }
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected')
        // Only show disconnect warning if we were actually connected before
        if (wsConnected) {
          setWsConnected(false)
          toast.warning('⚠️ Real-time updates disconnected', {
            description: 'Attempting to reconnect...'
          })
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error)
        if (wsConnected) {
          setWsConnected(false)
          toast.error('❌ Connection error', {
            description: 'Failed to establish real-time connection.'
          })
        }
      },
      onRefreshNeeded: () => {
        refreshEmails()
      }
    })

    // Connect to WebSocket
    wsClient.connect().catch(console.error)

    // Cleanup on unmount
    return () => {
      wsClient.disconnect()
    }
  }, [mutate, refreshEmails, emails, selectedEmail, pendingDraftId])

  // Clear pendingDraftId when new drafts are added to the current email
  useEffect(() => {
    const currentEmailData = emails[selectedEmail]
    if (pendingDraftId && currentEmailData?.execution?.drafts && currentEmailData.execution.drafts.length > 0) {
      // Check if there are any drafts that were created after the pending draft was initiated
      const hasNewDrafts = currentEmailData.execution.drafts.some(draft => {
        const draftTime = new Date(draft.created_at).getTime()
        const pendingTime = parseInt(pendingDraftId.replace('pending-', ''))
        return draftTime >= pendingTime
      })
      
      if (hasNewDrafts) {
        setPendingDraftId(null)
        setIsDraftGenerating(false)
        setDraftGenerationStatus('')
        setActiveAccordionItem('item-0') // Focus on the newest draft
      }
    }
  }, [emails, selectedEmail, pendingDraftId])

  const generateDraft = async () => {
    setShowDraft(true)
    setDraftContent("Generating AI response...")

    // Simulate AI generation
    setTimeout(() => {
      setDraftContent(`Hi Finance Team,

Thank you for the comprehensive budget review and the detailed breakdown of the July campaign adjustments.

I've reviewed the proposed changes and they align well with our Q3 growth objectives. The strategic shift toward influencer partnerships in Tier 2 cities is particularly promising given our recent market research.

A few thoughts on your questions:

1. **Distribution Alignment**: The current allocation strongly supports our Q3 objectives, especially the increased focus on micro-creators which should improve our cost-per-acquisition metrics.

2. **Risk Assessment**: The 96% spend utilization looks healthy. My only concern is ensuring we have adequate buffer for creative testing iterations - perhaps we could reserve 2-3% specifically for rapid A/B testing pivots.

3. **Go-ahead**: I'm comfortable moving forward with this budget structure. Let's schedule that sync for Thursday morning to finalize any last-minute adjustments before the leadership presentation.

I'll review the attached documents in detail and provide any additional feedback by end of day.

Best regards,
Faris`)
    }, 2000)
  }

  const handleTemplateSelect = async (template: any, customPrompt?: string) => {
    const newDraftId = `pending-${Date.now()}`
    
    setIsDraftGenerating(true)
    setPendingDraftId(newDraftId)
    setActiveAccordionItem(newDraftId)
    setDraftGenerationStatus('Generating with template...')
    setShowTemplateSelector(false)
    
    toast.loading(`Generating draft with template: ${template.name}`, {
      id: 'draft-generation'
    })
    
    try {
      // First, use the template to generate a draft via the suggested templates API
      const templateResponse = await fetch(`/api/emails/${currentEmail?.id}/suggested-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          customPrompt: customPrompt
        })
      })

      if (templateResponse.ok) {
        const templateData = await templateResponse.json()
        setDraftGenerationStatus('Template applied. Starting AI enhancement...')
        
        // Then use the n8n webhook for AI processing
        const response = await fetch(`http://localhost:5678/webhook-test/19297234-8faa-4a97-9cbc-d9fbc0afe2d4`, {
          method: 'POST',
          body: JSON.stringify({
            gmail_id: currentEmail?.gmail_id,
            template_id: template.id,
            custom_prompt: customPrompt?.trim() || undefined,
            template_content: templateData.draft_content
          })
        })

        if (response.ok) {
          setDraftGenerationStatus('AI is enhancing your template-based response...')
          toast.success('Template applied! AI is now enhancing your response.', {
            id: 'draft-generation'
          })
        } else {
          throw new Error(`n8n request failed with status ${response.status}`)
        }
      } else {
        throw new Error(`Template application failed with status ${templateResponse.status}`)
      }
      
    } catch (error) {
      console.error('Error generating draft with template:', error)
      setDraftGenerationStatus('Error generating draft')
      
      toast.error('Failed to generate draft with template. Please try again.', {
        id: 'draft-generation'
      })
      
      // Clean up pending draft on error
      setTimeout(() => {
        setPendingDraftId(null)
        setDraftGenerationStatus('')
        setIsDraftGenerating(false)
      }, 3000)
    }
  }

  const currentEmail = emails[selectedEmail]
  return (
    <div className="h-screen flex bg-[#f7f7f7]">
      {/* Sidebar */}
      <div className="min-w-[250px]  border-r border-gray-200 flex flex-col  bg-muted">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Fluxyn</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search something..." className="pl-10 text-sm" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wider mb-3">MENU</div>
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg border-0.5 border-[#dbdbdb] !bg-[#ebebeb]"
            >
              <Mail className="w-4 h-4" strokeWidth={2.3}/>
              <span className="text-sm">Inbox</span>
            </Link>
            <Link
              href="/templates"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg  hover:bg-gray-100"
            >
              <FileText className="w-4 h-4" strokeWidth={2.3}/>
              <span className="text-sm">Templates</span>
            </Link>
            <Link
              href="/knowledge"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg  hover:bg-gray-100"
            >
              <Brain className="w-4 h-4" strokeWidth={2.3} />
              <span className="text-sm">Knowledge Base</span>
            </Link>
          </div>
        </nav>

        {/* Settings */}

        <div className="p-4 space-y-1">
          <div className={'flex items-center space-x-3 justify-between'}>
            <p className={'text-sm'}>5 of 5 processed</p>
            <button className={'text-[10px] bg-primary px-2 py-1 rounded-md text-white'}>Upgrade</button>
          </div>
          <Progress value={100}/>
        </div>
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/settings"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg  hover:bg-gray-100"
          >
            <Settings className="w-4 h-4" strokeWidth={2.3}/>
            <span className="text-sm">Settings</span>
          </Link>
        </div>

        {/* Company Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">JC</span>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Jo Creative Inc.</div>
              <div className="text-xs text-gray-500">39 members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className={'flex flex-1 m-2 border-gray-200 rounded-r-xl border'}>
        <div className="w-80 bg-white border-r border-gray-200 rounded-l-xl">
          <div className="px-4 py-2 pb-[11px] border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-gray-900">Inbox</h2>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                     title={wsConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'} 
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">1 of {emails?.length || 0}</span>
                <Button variant="ghost" size="sm">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh_-_74px)]">
            {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading emails...
                </div>
            ) : error ? (
                <div className="p-4 text-center text-red-500">
                  {error.message || 'Failed to load emails'}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={() => mutate()}
                  >
                    Retry
                  </Button>
                </div>
            ) : emails.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No emails found
                </div>
            ) : (
                emails.map((email, index) => (
                    <div
                        key={email?.id}
                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                            selectedEmail === index ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                        }`}
                        onClick={() => setSelectedEmail(index)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">{currentEmail?.from?.charAt(0)}{currentEmail?.from?.split(" ")[1]?.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{email?.from}</div>
                            <div className="text-xs text-gray-500">{email?.email}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">{email?.time}</div>
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center space-x-2">
                          {email?.execution && (
                              <Badge
                                  variant={email?.execution.execution_status === 'completed' ? 'success' :
                                      email?.execution.execution_status === 'failed' ? 'destructive' :
                                          email?.execution.execution_status === 'running' ? 'secondary' : 'outline'}
                                  className="text-xs"
                              >
                                {email?.execution.execution_status}
                              </Badge>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-medium text-gray-900 mb-1">{email?.subject?.length > 0 ? email?.subject : "No Subject"}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2">{email?.preview}</p>

                      {email?.unread && <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>}
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 flex flex-col rounded-r-xl">
          {/* Email Header */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className={'flex items-center justify-between flex-row-reverse'}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                </div>
                <div className="flex items-center space-x-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">View {currentEmail?.execution?.drafts?.length.toString()} Drafts <ChevronLeft className="w-2 h-2 -ml-1 -mr-1" /></Button>
                    </SheetTrigger>
                    <SheetContent>
                      <div className={'flex space-x-2 justify-between w-full'}>
                        <SheetHeader>
                          <SheetTitle className={'w-full'}>
                            Drafts
                          </SheetTitle>
                          <SheetDescription>
                            {currentEmail?.execution?.drafts?.length.toString()} drafts
                          </SheetDescription>
                        </SheetHeader>
                        <div className="flex space-x-2">
                          <SheetClose asChild>
                            <Button
                                variant="outline"
                                onClick={() => setShowTemplateSelector(true)}
                                disabled={isDraftGenerating}
                                className="flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              Use Template
                            </Button>
                          </SheetClose>

                          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button disabled={isDraftGenerating}>
                                {isDraftGenerating ? (
                                  <Spinner className={'mr-2'}/>
                                ) : (
                                  <Sparkles className="w-4 h-4 mr-2" />
                                )}
                                {isDraftGenerating ? (draftGenerationStatus || 'Generating...') : 'AI Draft'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <div className="space-y-2">
                                  <h4 className="font-medium leading-none">Custom Prompt</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Add specific instructions for the AI to follow when generating your response.
                                  </p>
                                </div>
                                <Textarea
                                  placeholder="e.g., Be professional and formal, include specific points about budget allocation..."
                                  value={customPrompt}
                                  onChange={(e) => setCustomPrompt(e.target.value)}
                                  className="min-h-[100px]"
                                />
                                <div className="flex justify-between space-x-2">
                                  <Button
                                    variant="outline"
                                    className={'w-full'}
                                    onClick={() => {
                                      setCustomPrompt('')
                                      setIsPopoverOpen(false)
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={async () => {
                                      const newDraftId = `pending-${Date.now()}`
                                      
                                      setIsDraftGenerating(true)
                                      setPendingDraftId(newDraftId)
                                      setActiveAccordionItem(newDraftId)
                                      setDraftGenerationStatus('Initializing AI generation...')
                                      setIsPopoverOpen(false)
                                      
                                      toast.loading('Starting AI draft generation...', {
                                        id: 'draft-generation'
                                      })
                                      
                                      try {
                                        setDraftGenerationStatus('Sending request to n8n...')
                                        
                                        const response = await fetch(`http://localhost:5678/webhook-test/19297234-8faa-4a97-9cbc-d9fbc0afe2d4`, {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            gmail_id: currentEmail?.gmail_id,
                                            custom_prompt: customPrompt.trim() || undefined
                                          })
                                        })

                                        if (response.ok) {
                                          setDraftGenerationStatus('AI is generating your response...')
                                          toast.success('Draft request sent successfully! AI is now crafting your response.', {
                                            id: 'draft-generation'
                                          })
                                        } else {
                                          throw new Error(`Request failed with status ${response.status}`)
                                        }
                                        
                                      } catch (error) {
                                        console.error('Error generating draft:', error)
                                        setDraftGenerationStatus('Error generating draft')
                                        
                                        toast.error('Failed to generate draft. Please try again.', {
                                          id: 'draft-generation'
                                        })
                                        
                                        // Clean up pending draft on error
                                        setTimeout(() => {
                                          setPendingDraftId(null)
                                          setDraftGenerationStatus('')
                                          setIsDraftGenerating(false)
                                        }, 3000)
                                      }
                                    }}
                                    disabled={isDraftGenerating}
                                  >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Draft
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className={'space-y-4 mt-4'}>
                        <Accordion
                            type="single"
                            collapsible
                            className="w-full"
                            value={activeAccordionItem}
                            onValueChange={setActiveAccordionItem}
                        >
                          {/* Show loading accordion when there's a pending draft */}
                          {pendingDraftId && (
                            <AccordionItem value={pendingDraftId}>
                              <AccordionTrigger>
                                <div className={'space-x-2 flex items-center w-full justify-between mr-4'}>
                                  <div className="flex items-center space-x-2">
                                    <Spinner />
                                    <h3>Generating Draft...</h3>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="flex flex-col gap-4">
                                <div className="space-y-4 p-4">
                                  {/* Status indicator */}
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="flex space-x-1">
                                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">
                                      {draftGenerationStatus || 'AI is crafting your response...'}
                                    </p>
                                  </div>
                                  
                                  {/* Skeleton loading for email content */}
                                  <div className="space-y-3">
                                    {[
                                      { width: "75%", delay: 0 },
                                      { width: "100%", delay: 0.1 },
                                      { width: "85%", delay: 0.15 },
                                      { width: "80%", delay: 0.2 },
                                      { width: "100%", delay: 0.25 },
                                      { width: "65%", delay: 0.3 },
                                      { width: "85%", delay: 0.35 },
                                      { width: "75%", delay: 0.4 },
                                      { width: "100%", delay: 0.45 },
                                      { width: "80%", delay: 0.5 }
                                    ].map((skeleton, index) => (
                                      <motion.div
                                        key={index}
                                        className="h-4 bg-gray-200 rounded"
                                        initial={{ width: "0%" }}
                                        animate={{ 
                                          width: skeleton.width,
                                          opacity: [0.3, 0.8, 0.3]
                                        }}
                                        transition={{
                                          width: {
                                            duration: 0.8,
                                            delay: skeleton.delay,
                                            ease: [0.22, 1, 0.36, 1]
                                          },
                                          opacity: {
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: [0.22, 1, 0.36, 1]
                                          }
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                          
                          {/* Show actual drafts */}
                          { currentEmail?.execution?.drafts && currentEmail.execution.drafts.length > 0 && 
                            currentEmail.execution.drafts
                            .slice()
                            .reverse()
                            .map((draft, i)=> {
                              console.log({draft})
                            return <AccordionItem key={`draft-${draft.id || i}`} value={`item-${i}`}>
                              <AccordionTrigger>
                                <div className={'space-x-2 flex items-center w-full justify-between mr-4'}>
                                  <h3>Draft {(currentEmail?.execution?.drafts.length ?? 0) - i}</h3>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      {activeAccordionItem === `item-${i}` && (
                                          <motion.div
                                              initial={{ opacity: 0, x: 20 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                          >
                                            <Button variant="outline">
                                              Actions <ChevronDown className="w-2 h-2 -ml-1 -mr-1" />
                                            </Button>
                                          </motion.div>
                                      )}

                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56" align="start">
                                      <DropdownMenuItem onClick={async ()=>{
                                        toast.loading('Accepting draft...', {
                                          id: `accept-draft-${i}`
                                        })

                                        try {
                                          const response = await fetch(`http://localhost:5678/webhook-test/4dfa0045-9660-4db1-a7e9-e97ecbc27878`, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                              id: draft.draft_id,
                                            })
                                          })

                                          if (response.ok) {
                                            toast.success('✅ Draft accepted successfully!', {
                                              id: `accept-draft-${i}`,
                                              description: 'The draft has been approved and will be processed.'
                                            })
                                          } else {
                                            throw new Error(`Request failed with status ${response.status}`)
                                          }
                                        } catch (error) {
                                          toast.error('Failed to accept draft', {
                                            id: `accept-draft-${i}`,
                                            description: 'Please try again.'
                                          })
                                        }
                                      }}>
                                        Accept
                                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        toast.success('🗑️ Draft rejected', {
                                          description: 'The draft has been rejected and removed from consideration.'
                                        })
                                      }}>
                                        Reject
                                        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="flex flex-col gap-4 text-balance">
                                <div className={'flex space-x-2 items-center justify-between w-full'}>
                                  <p>Knowledge: </p>
                                  {/*<SourceBadges */}
                                  {/*  citations={draft.citations || extractCitationsFromContent(draft.draft_content).citations}*/}
                                  {/*  usedCitations={draft.used_citations || extractCitationsFromContent(draft.draft_content).usedCitations}*/}
                                  {/*/>*/}
                                  {draft.citations?.sources.map(s=>{
                                      return <Badge>{s.title}</Badge>
                                  })}
                                </div>
                                <hr/>
                                <p>
                                  <SafeHtmlRenderer
                                    htmlContent={draft.draft_content}
                                    className="draft-content"
                                  />
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          })
                          }
                        </Accordion>
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Button
                      variant="destructive-bordered"
                      onClick={async () => {
                        const confirmed = confirm('Are you sure you want to remove this email?')
                        if (!confirmed) return

                        try {
                          const res = await fetch('/api/emails', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              gmail_ids: [currentEmail?.gmail_id]
                            }),
                          })

                          if (!res.ok) {
                            toast.error('Failed to delete email.')
                            return
                          }

                          // Optionally refetch or update state
                          toast.success('Email deleted successfully!')
                        } catch (error) {
                          console.error('Error deleting email:', error)
                          alert('An error occurred while deleting the email.')
                        }
                      }}
                  >
                    Remove
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>


                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                      <DropdownMenuItem>
                        Accept
                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        Reject
                        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/*<Dialog>*/}
                  {/*  <DialogTrigger>*/}
                  {/*    <Button>*/}
                  {/*      <Sparkles className="w-4 h-4 mr-2" />*/}
                  {/*      Regenerate Draft*/}
                  {/*    </Button>*/}
                  {/*    <DialogContent>*/}
                  {/*      <DialogHeader>*/}
                  {/*        <DialogTitle>AI Email Summary</DialogTitle>*/}
                  {/*        <DialogDescription>*/}
                  {/*          <p>describe the message you would like to send</p>*/}
                  {/*        </DialogDescription>*/}
                  {/*      </DialogHeader>*/}
                  {/*      <DialogBody className={'flex space-x-2'}>*/}

                  {/*        <Input placeholder="Enter your message here..." />*/}
                  {/*        <Button className={'w-1/3'}>Send</Button>*/}
                  {/*      </DialogBody>*/}
                  {/*    </DialogContent>*/}
                  {/*  </DialogTrigger>*/}
                  {/*</Dialog>*/}

                </div>
              </div>

              <div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">⭐ {currentEmail?.subject?.length > 0 ? currentEmail?.subject : "No Subject"}</h1>

                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{currentEmail?.from?.charAt(0)}{currentEmail?.from?.split(" ")[1]?.charAt(0)}</span>
                    </div>
                    <div>
                      <p>{currentEmail?.from}</p>
                      <p className="text-gray-400">{currentEmail?.email}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Email Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-white break-words">
            <div className="max-w-4xl w-full">
              <div className="prose prose-sm max-w-none w-full break-words">
                <div className="whitespace-pre-wrap break-words text-gray-800 leading-relaxed break-all overflow-x-auto">
                  {currentEmail?.content}
                </div>
              </div>

              {/* AI Draft */}
              {showDraft && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex items-center space-x-2 mb-4">
                      <Sparkles className="w-5 h-5 " />
                      <h3 className="text-lg font-semibold text-gray-900">
                        AI Generated Draft
                      </h3>
                    </div>
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <Textarea
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          className="min-h-[300px] bg-white"
                          placeholder="AI is generating your response..."
                      />
                      <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Use Template
                          </Button>
                          <Button variant="outline" size="sm">
                            <Brain className="w-4 h-4 mr-2" />
                            Regenerate
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline">Save Draft</Button>
                          <Button>
                            <Send className="w-4 h-4 mr-2" />
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Template Selection Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] m-4 overflow-hidden">
            <div className="p-6 overflow-y-auto max-h-[90vh]">
              <TemplateSelector
                emailId={currentEmail?.id?.toString()}
                onTemplateSelect={handleTemplateSelect}
                onClose={() => setShowTemplateSelector(false)}
                isGenerating={isDraftGenerating}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
