"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Zap, Brain, FileText, Shield, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handleOAuthLogin = async (provider: "gmail" | "outlook") => {
    setIsLoading(provider)
    
    if (provider === "gmail") {
      // Redirect to Gmail OAuth
      window.location.href = "/api/auth/gmail"
    } else if (provider === "outlook") {
      // Outlook OAuth not implemented yet - show placeholder
      alert("Outlook integration coming soon\!")
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Fluxyn</span>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">View Demo</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          AI-Powered Email
          <span className="text-blue-600"> Automation</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Connect your email, automate responses with AI, and streamline your workflow with intelligent templates and
          contextual knowledge.
        </p>

        {/* OAuth Login Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleOAuthLogin("gmail")}>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle>Connect Gmail</CardTitle>
              <CardDescription>Secure OAuth integration with Google</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                disabled={isLoading === "gmail"}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOAuthLogin("gmail")
                }}
              >
                {isLoading === "gmail" ? "Connecting..." : "Connect Gmail"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleOAuthLogin("outlook")}
          >
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Connect Outlook</CardTitle>
              <CardDescription>Secure OAuth integration with Microsoft</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                disabled={isLoading === "outlook"}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOAuthLogin("outlook")
                }}
              >
                {isLoading === "outlook" ? "Connecting..." : "Connect Outlook"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Powerful Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">n8n Integration</h3>
              <p className="text-gray-600">Seamlessly pipe emails into automated workflows</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Drafting</h3>
              <p className="text-gray-600">Generate contextual replies automatically</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Templates</h3>
              <p className="text-gray-600">Create and manage reusable email templates</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Contextual Knowledge</h3>
              <p className="text-gray-600">Upload documents for accurate, on-brand responses</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">Fluxyn</span>
          </div>
          <p className="text-gray-400">© 2024 Fluxyn. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
