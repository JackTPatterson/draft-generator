"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Upload, Search, FileText, Plus, MoreHorizontal, Trash2, Edit, Eye, 
  ArrowLeft, Mail, Brain, BookOpen, Filter, RefreshCw, CheckCircle, 
  XCircle, Clock, AlertCircle, Download, Tags, Calendar, FileType,
  Layers, Target, Zap
} from "lucide-react"
import Link from "next/link"
import Spinner from "@/components/Spinner";

interface KnowledgeDocument {
  id: string
  title: string
  description?: string
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  status: 'uploading' | 'processing' | 'processed' | 'failed' | 'archived'
  category?: string
  tags?: string[]
  key_topics?: string[]
  usage_count: number
  word_count?: number
  page_count?: number
  created_at: string
  updated_at: string
  processed_at?: string
}

interface KnowledgeCategory {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  document_count: number
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    processed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Processed' },
    processing: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Processing' },
    uploading: { color: 'bg-blue-100 text-blue-800', icon: Upload, label: 'Uploading' },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
    archived: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: 'Archived' }
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processed
  const IconComponent = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function UploadDropzone({ onUpload, categories }: { 
  onUpload: (files: File[], metadata: any) => void,
  categories: KnowledgeCategory[]
}) {
  const [uploadMetadata, setUploadMetadata] = useState({
    category: '',
    tags: '',
    description: ''
  })
  const [dragActive, setDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(files)
    }
  }

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles, uploadMetadata)
      setSelectedFiles([])
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input 
          type="file"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.docx,.txt,.md,.html,.xlsx,.csv"
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {dragActive ? (
            <p className="text-blue-600">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag & drop files here, or <span className="text-blue-600">click to browse</span>
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, DOCX, TXT, MD, HTML, XLSX, CSV (max 10MB each)
              </p>
            </div>
          )}
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Files to upload:</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" />
              <span>{file.name}</span>
              <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={uploadMetadata.category} onValueChange={(value) => 
            setUploadMetadata({ ...uploadMetadata, category: value })
          }>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={uploadMetadata.tags}
            onChange={(e) => setUploadMetadata({ ...uploadMetadata, tags: e.target.value })}
            placeholder="policy, procedure, guide (comma-separated)"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={uploadMetadata.description}
          onChange={(e) => setUploadMetadata({ ...uploadMetadata, description: e.target.value })}
          placeholder="Brief description of the document content..."
          rows={3}
        />
      </div>

      {selectedFiles.length > 0 && (
        <Button onClick={handleUpload} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          Upload {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  )
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    loadDocuments()
    loadCategories()
  }, [])

  const loadDocuments = async () => {
    try {
      const params = new URLSearchParams({
        userId: 'demo-user',
        ...(selectedCategory && selectedCategory !== '__all__' && { category: selectedCategory }),
        ...(selectedStatus && selectedStatus !== '__all__' && { status: selectedStatus }),
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/knowledge/documents?${params}`)
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/knowledge/categories?userId=demo-user')
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const handleUpload = async (files: File[], metadata: any) => {
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', 'demo-user')
      formData.append('category', metadata.category)
      formData.append('tags', metadata.tags)
      formData.append('description', metadata.description)
      formData.append('title', file.name.replace(/\.[^/.]+$/, "")) // Remove extension

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        const response = await fetch('/api/knowledge/documents', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
          setTimeout(() => {
            setUploadProgress(prev => {
              const updated = { ...prev }
              delete updated[file.name]
              return updated
            })
          }, 2000)
        } else {
          throw new Error('Upload failed')
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        setUploadProgress(prev => {
          const updated = { ...prev }
          delete updated[file.name]
          return updated
        })
      }
    })

    await Promise.all(uploadPromises)
    setShowUploadDialog(false)
    loadDocuments()
  }

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/knowledge/documents/${documentId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId))
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = !selectedCategory || selectedCategory === "__all__" || doc.category === selectedCategory
    const matchesStatus = !selectedStatus || selectedStatus === "__all__" || doc.status === selectedStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return '📄'
      case 'docx': return '📝'
      case 'xlsx': return '📊'
      case 'txt': case 'md': return '📃'
      case 'html': return '🌐'
      case 'csv': return '📈'
      default: return '📄'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner/>
          <p className="text-gray-600 mt-1">Loading knowledge base...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Knowledge Base</span>
              </div>
            </div>
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Documents
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Business Documents</DialogTitle>
                  <DialogDescription>
                    Upload documents to enhance AI email responses with your business knowledge
                  </DialogDescription>
                </DialogHeader>
                <UploadDropzone onUpload={handleUpload} categories={categories} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Knowledge Base</h1>
          <p className="text-gray-600">Upload and manage documents to enhance AI-powered email responses</p>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Uploading Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(uploadProgress).map(([filename, progress]) => (
                <div key={filename} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{filename}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Categories Overview */}
        {categories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <Card 
                  key={category.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <CardContent className="p-4 text-center">
                    <div 
                      className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      <span className="text-xl">📁</span>
                    </div>
                    <h3 className="font-medium text-sm">{category.name}</h3>
                    <p className="text-xs text-gray-500">{category.document_count} docs</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search documents..." 
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
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDocuments}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getFileTypeIcon(document.file_type)}</span>
                      <CardTitle className="text-lg line-clamp-1">{document.title}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {document.description || 'No description available'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={document.status} />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  {document.category && (
                    <Badge 
                      variant="secondary"
                      style={{ 
                        backgroundColor: categories.find(c => c.name === document.category)?.color + '20',
                        color: categories.find(c => c.name === document.category)?.color 
                      }}
                    >
                      {document.category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {document.file_type.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Document Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  {document.word_count && (
                    <div>
                      <div className="text-sm font-medium">{document.word_count.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Words</div>
                    </div>
                  )}
                  {document.page_count && (
                    <div>
                      <div className="text-sm font-medium">{document.page_count}</div>
                      <div className="text-xs text-gray-500">Pages</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{document.usage_count}</div>
                    <div className="text-xs text-gray-500">Uses</div>
                  </div>
                </div>

                {/* Key Topics */}
                {document.key_topics && document.key_topics.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Key Topics:</p>
                    <div className="flex flex-wrap gap-1">
                      {document.key_topics.slice(0, 3).map((topic, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                      {document.key_topics.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{document.key_topics.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {document.tags && document.tags.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {document.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {document.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{document.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(document.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
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
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{document.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDocument(document.id)}>
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
        {filteredDocuments.length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || (selectedCategory && selectedCategory !== "__all__") || (selectedStatus && selectedStatus !== "__all__") ? 
                'No documents found' : 
                'No documents yet'
              }
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || (selectedCategory && selectedCategory !== "__all__") || (selectedStatus && selectedStatus !== "__all__") ? 
                'Try adjusting your search or filters' : 
                'Upload your first business document to get started with AI-enhanced email responses'
              }
            </p>
            {!searchTerm && (!selectedCategory || selectedCategory === "__all__") && (!selectedStatus || selectedStatus === "__all__") && (
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
