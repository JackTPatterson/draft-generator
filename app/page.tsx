"use client"

import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button"
import Link from "next/link"
import {motion, useAnimation} from "framer-motion"
import AnimatedBeamDemo from "@/components/animated-beam-unidirectional"
import {ChevronDown, LayoutDashboard} from "lucide-react"
import {useSession} from "@/lib/auth-client"

export function AnimatedHeading() {
    const lines = [
        "Email Handled",
        "Faster Than",
        "The Speed of Thought"
    ]

    const starControls = useAnimation()

    useEffect(() => {
        // Start fast spin
        starControls.start({
            rotate: 360,
            transition: {duration: 0.2, ease: "linear", repeat: Infinity}
        })
        // After 1 second, switch to slow spin
        const timer = setTimeout(() => {
            starControls.start({
                rotate: 360,
                transition: {duration: 2, ease: "linear", repeat: Infinity}
            })
        }, 1000)
        return () => clearTimeout(timer)
    }, [starControls])

    return (
        <div className="mb-8 md:space-y-0 -space-y-4">
            {lines.map((text, idx) => (
                <div key={idx} className="overflow-hidden">
                    <motion.h1
                        className="text-5xl md:text-7xl lg:text-8xl font-serif text-gray-900 mb-4 md:leading-tight leading-12"
                        initial={{y: "100%", opacity: 0}}
                        animate={{y: "0%", opacity: 1}}
                        transition={{
                            delay: idx * 0.2,
                            duration: 0.8,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                    >
                        {text}
                        {idx === lines.length - 1 && (
                            <motion.span
                                className="text-[#25206b] ml-2 inline-block"
                                style={{transformOrigin: 'center center'}}
                            >
                                *
                            </motion.span>
                        )}
                    </motion.h1>
                </div>
            ))}
        </div>
    )
}

export default function LandingPage() {
    const { data: session } = useSession()

    return (
        <div className="min-h-screen" style={{backgroundColor: "#f4f0ea"}}>
            {/* Header */}
            <div className="absolute inset-0 md:-mt-64 w-full h-full z-0 pointer-events-none">
                <AnimatedBeamDemo />
            </div>
            <nav className=" px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M12 2L2 7L12 12L22 7L12 2Z"
                                stroke="#6366F1"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="text-xl font-bold text-gray-900">Healthqoe</span>
                    </Link>

                    {/* Main navigation */}
                    <div className="hidden md:flex items-center space-x-4 text-gray-700">
                        <Link href="#" className="hover:text-gray-900 px-4 py-1.5 transition-all duration-200 hover:bg-white/40 hover:rounded-full  hover:backdrop-blur-sm border border-transparent hover:border-white/50">Home</Link>
                        <Link href="#" className="hover:text-gray-900 px-4 py-1.5 transition-all duration-200 hover:bg-white/40 hover:rounded-full  hover:backdrop-blur-sm border border-transparent hover:border-white/50">How It Works</Link>
                        <Link href="#" className="hover:text-gray-900 px-4 py-1.5 transition-all duration-200 hover:bg-white/40 hover:rounded-full  hover:backdrop-blur-sm border border-transparent hover:border-white/50">Pricing</Link>
                        <Link href="#" className="hover:text-gray-900 px-4 py-1.5 transition-all duration-200 hover:bg-white/40 hover:rounded-full  hover:backdrop-blur-sm border border-transparent hover:border-white/50">FAQ</Link>
                        <Link href="#" className="hover:text-gray-900 px-4 py-1.5 transition-all duration-200 hover:bg-white/40 hover:rounded-full  hover:backdrop-blur-sm border border-transparent hover:border-white/50">Support</Link>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-4">
                        {session?.user ? (
                            // Logged in user - show Dashboard link
                            <Link
                                href="/dashboard"
                                className="flex items-center space-x-2 px-6 py-3 bg-black text-white rounded-full transition text-sm"
                            >
                                <span>Dashboard</span>
                            </Link>
                        ) : (
                            // Not logged in - show Sign In and Get Started
                            <>
                                <Link
                                    href="/login"
                                    className="text-gray-700 hover:text-gray-900 font-medium"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-6 py-2 bg-black text-white rounded-[16px] hover:bg-gray-800 transition"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative px-6 py-16 md:py-16">
                {/* Background Blur */}
    {/*            <motion.div*/}
    {/*                className="*/}
    {/*  absolute top-1/3 left-1/2*/}
    {/*  -translate-x-1/2 -translate-y-1/2*/}
    {/*  h-[400px] w-[400px] rounded-full*/}
    {/*  opacity-40 blur-3xl*/}
    {/*  md:h-[800px] md:w-[800px]*/}
    {/*  bg-[radial-gradient(ellipse_at_center,_rgba(37,32,107,0.5)_0%,_rgba(37,32,107,0.5)_30%,_transparent_50%)]*/}
    {/*  z-0*/}
    {/*"*/}
    {/*                initial={{opacity: 0}}*/}
    {/*                transition={{*/}
    {/*                    delay: 0.5,*/}
    {/*                    duration: 2,*/}
    {/*                    ease: [0.23, 1, 0.32, 1],*/}
    {/*                }}*/}
    {/*                viewport={{once: true}}*/}
    {/*                whileInView={{opacity: 1}}*/}
    {/*            />*/}
                <div className="relative z-10 max-w-5xl mx-auto text-center">
                    {/* Subtitle */}
                    <span
                        className="inline-block px-4 py-1 text-sm font-medium text-black mb-6"
                        style={{
                            background: "rgba(255, 255, 255, 0.2)",
                            borderRadius: "24px",
                            boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
                            backdropFilter: "blur(5px)",
                            WebkitBackdropFilter: "blur(5px)",
                            border: "1px solid rgba(255, 255, 255, 0.3)"
                        }}
                    >
                        Next Gen AI Email Automation
                    </span>

                    {/* Main Headlines */}
                    <AnimatedHeading/>

                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                        transition={{
                            duration: 1,
                            delay: 0.5,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                    >
                        <p className="text-lg md:text-xl text-gray-500 mb-12 max-w-3xl mx-auto leading-relaxed">
                            Connect Gmail or Outlook in 30 seconds and let Emilia triage messages, write replies in your
                            voice, and book
                            meetings automatically—so you can focus on real work.
                        </p>

                        {/* Works with section */}
                        <div className="mb-12 flex space-x-2 justify-center items-center">
                            <p className=" font-medium">Works with</p>
                            <div className="flex items-center justify-center space-x-2">
                                {/* Gmail Logo */}
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-10 h-10 p-1  rounded-full bg-white flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      <img src={'https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-02-512.png'}/>
                    </span>
                                    </div>
                                </div>
                                {/* Outlook Logo */}
                                {/*<div className="flex items-center space-x-2">*/}
                                {/*    <div*/}
                                {/*        className="w-10 h-10 rounded-full bg-white flex items-center justify-center">*/}
                                {/*            <span className="text-white text-sm font-bold">*/}
                                {/*              <img src={'https://www.logo.wine/a/logo/Outlook_Mobile/Outlook_Mobile-Logo.wine.svg'}/>*/}
                                {/*            </span>*/}
                                {/*    </div>*/}
                                {/*</div>*/}
                            </div>
                        </div>

                        {/* CTA Button */}
                        <Button className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-sm !rounded-full">
                            Start Your 14-Day Free Trial
                        </Button>
                    </motion.div>


                </div>
            </main>
        </div>
    )
}
