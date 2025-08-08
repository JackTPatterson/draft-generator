import type React from "react"
import type { Metadata } from "next"
import { Sora , Poppins} from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/AuthProvider"

const inter = Poppins({ subsets: ["latin"], weight: ['200', '300', '400', '600', '500'] })

export const metadata: Metadata = {
  title: "Fluxyn - AI-Powered Email Automation",
  description: "Streamline your email workflow with intelligent automation, templates, and contextual AI responses.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
