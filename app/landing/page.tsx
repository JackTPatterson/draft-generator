'use client'

import { Star } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br relative overflow-hidden">
      {/* Geometric Pattern Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-white/10 rotate-45"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border border-white/10 rotate-12"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-white">uidino</h1>
        </div>
        <nav className="flex items-center space-x-8">
          <button className="text-white/80 hover:text-white text-sm">Work</button>
          <button className="text-white/80 hover:text-white text-sm">Pricing</button>
          <button className="text-white/80 hover:text-white text-sm">Benefits</button>
          <button className="text-white/80 hover:text-white text-sm">FAQ</button>
          <button className="px-6 py-2 text-sm font-medium text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors">
            Buy Plan
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-8">
        {/* Premium Badge */}
        <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm mb-8">
          100% Premium Design Services
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="text-6xl md:text-7xl font-light text-white mb-6 leading-tight">
            Unlimited Design,<br />
            <em className="italic">Single Monthly Charge</em>
          </h1>
          <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
            Ui-Dino Agency Deliver Premium Design Services Within Budget Constraints,<br />
            Ensuring Accessibility For Everyone
          </p>
          
          <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full text-lg transition-colors mb-4">
            Our Pricing
          </button>
          
          <p className="text-white/60 text-sm">
            Pause Or Cancel Anytime Without Notification
          </p>
        </div>

        {/* Customer Avatars and Rating */}
        <div className="flex items-center space-x-8 mb-16">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-orange-400 border-2 border-white flex items-center justify-center">
                <span className="text-sm font-medium text-white">J</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-400 border-2 border-white flex items-center justify-center">
                <span className="text-sm font-medium text-white">M</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-400 border-2 border-white flex items-center justify-center">
                <span className="text-sm font-medium text-white">S</span>
              </div>
            </div>
          </div>
          
          <div className="h-8 w-px bg-white/20"></div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
              ))}
            </div>
            <span className="text-white/80 text-sm">Rated 5.0 on clutch</span>
          </div>
        </div>

        {/* Trust Section */}
        <div className="text-center">
          <p className="text-white/60 text-sm mb-8">Trusted By Startups & Fortune 500</p>
          
          {/* Company Logos */}
          <div className="flex items-center justify-center space-x-12 opacity-60">
            <div className="text-white font-bold text-xl">Deloitte.</div>
            <div className="text-white font-bold text-xl">Notice</div>
            <div className="text-white font-bold text-xl">monday.com</div>
            <div className="text-white font-bold text-xl">PHILIPS</div>
            <div className="text-white font-bold text-xl">Upwork</div>
            <div className="text-white font-bold text-xl">taskade</div>
            <div className="text-white font-bold text-xl">teero</div>
          </div>
        </div>
      </main>

      {/* Laptop Mockup at Bottom */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/4">
        <div className="w-96 h-64 bg-gradient-to-t from-gray-800 to-gray-700 rounded-t-xl shadow-2xl relative">
          {/* Screen */}
          <div className="absolute inset-2 bg-gradient-to-br from-purple-600 via-blue-600 to-green-500 rounded-lg">
            <div className="absolute inset-4 bg-black/20 rounded backdrop-blur-sm flex items-center justify-center">
              <div className="text-white/80 text-center">
                <div className="w-8 h-8 bg-white/20 rounded mb-2 mx-auto"></div>
                <div className="w-16 h-2 bg-white/20 rounded"></div>
              </div>
            </div>
          </div>
          {/* Keyboard area */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gray-800 rounded-b-xl"></div>
        </div>
      </div>
    </div>
  )
}