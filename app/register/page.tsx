"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signIn, signUp } from "@/lib/auth-client"
import { Loader2, Mail, Eye, User } from "lucide-react"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Registration failed")
      } else {
        setSuccess(true)
        // Redirect to dashboard after successful registration
        setTimeout(() => {
          router.push("/dashboard")
          router.refresh()
        }, 1500)
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      })

      if (result.error) {
        setError(result.error.message || "Google sign-in failed")
        setIsLoading(false)
      }
    } catch (err) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f7f5f3" }}>
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <h2 className="text-3xl font-serif  mb-2">Registration Successful!</h2>
            <p className="text-gray-500">Welcome to the platform. Redirecting you to the dashboard...</p>
          </div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin " />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary to-[#403d70]"></div>

        {/* Logo in top left */}
        <div className="absolute top-8 left-8 z-10">
          <div className="flex items-center space-x-2 text-white">
            <div className="w-8 h-8  rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Fluxyn</span>
          </div>
        </div>

        {/* Centered content */}
        <div className="relative z-10 flex items-center justify-center w-full px-12">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight text-balance">
              Join Our
              AI-Powered Email Automation Platform
            </h1>
            <p className="text-xl text-gray-300 max-w-md mx-auto">
              Start automating your email management with intelligent assistance
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/20 to-transparent"></div>
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8" style={{ backgroundColor: "#f7f5f3" }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-500">Enter your information to get started</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-medium">
                Full Name*
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 bg-white border-gray-200 focus:border-gray-400 focus:ring-0 rounded-lg h-12"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email*
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 bg-white border-gray-200 focus:border-gray-400 focus:ring-0 rounded-lg h-12"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Password*
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-gray-200 focus:border-gray-400 focus:ring-0 rounded-lg h-12 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Password must be at least 8 characters long
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                Confirm Password*
              </Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white border-gray-200 focus:border-gray-400 focus:ring-0 rounded-lg h-12 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white h-12 rounded-lg font-medium text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  CREATING ACCOUNT...
                </>
              ) : (
                "CREATE ACCOUNT"
              )}
            </Button>

            <div className="text-center">
              <span className="text-gray-500">Already have an account? </span>
              <Link href="/login" className="text-gray-900 underline hover:no-underline font-medium">
                Sign in
              </Link>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#f7f5f3] text-gray-500">Or continue with</span>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              className="w-full h-12 bg-white border-gray-200 hover:"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Google
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}