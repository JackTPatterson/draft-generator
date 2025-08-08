'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import Link from "next/link"
import {authClient, useSession} from "@/lib/auth-client";

export default function PricingPage() {

    const { data: session, isPending } = useSession()


    const plans = [
        {
            id: '',
            name: "Basic",
            description: "Perfect for individuals getting started with AI email management",
            price: "$19",
            period: "per month",
            yearlyPrice: "$190",
            yearlyPeriod: "per year",
            popular: false,
            features: [
                "1 email account",
                "Up to 500 emails/month",
                "Basic AI responses",
                "Email triage & sorting",
                "Mobile app access",
                "Email support",
                "Basic templates",
                "Calendar integration",
            ],
            notIncluded: ["Team collaboration", "Advanced AI training", "Priority support", "Custom integrations"],
        },
        {
            id: '',
            name: "Pro",
            description: "Ideal for small teams and growing businesses",
            price: "$49",
            period: "per user/month",
            yearlyPrice: "$490",
            yearlyPeriod: "per user/year",
            popular: true,
            features: [
                "Up to 5 email accounts",
                "Unlimited emails",
                "Advanced AI responses",
                "Team collaboration tools",
                "Shared templates & signatures",
                "Priority email support",
                "Advanced analytics",
                "Custom AI training",
                "Multiple integrations",
                "Team performance insights",
            ],
            notIncluded: ["Dedicated account manager", "Custom SLA", "Advanced security features", "API access"],
        },
        {
            id: '',
            name: "Enterprise",
            description: "For large organizations with advanced needs",
            price: "Custom",
            period: "pricing",
            yearlyPrice: "Custom",
            yearlyPeriod: "pricing",
            popular: false,
            features: [
                "Unlimited email accounts",
                "Unlimited emails",
                "Enterprise AI models",
                "Advanced team management",
                "Custom integrations",
                "Dedicated account manager",
                "24/7 priority support",
                "Custom SLA",
                "Advanced security & compliance",
                "API access",
                "Custom AI training",
                "White-label options",
                "Advanced analytics & reporting",
                "Single sign-on (SSO)",
            ],
            notIncluded: [],
        },
    ]


    const handleSubscriptionPurchase = async (planName: string) => {
        if(session){
            try {
                await authClient.subscription.upgrade({
                    plan: planName.toLowerCase(),
                    successUrl: window.location.origin + "/dashboard",
                    cancelUrl: window.location.origin + "/pricing",
                    // annual: true, // Optional: upgrade to an annual plan
                    // referenceId: session?.user.id
                });
            } catch (error) {
                console.error('Subscription error:', error);
                alert('Failed to start subscription process. Please try again.');
            }
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/login';
        }
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: "#f7f5f3" }}>
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-6">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M12 2L2 7L12 12L22 7L12 2Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M2 17L12 22L22 17"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M2 12L12 17L22 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <Link href="/" className="text-lg font-semibold text-gray-900">
                        Lynq
                    </Link>
                </div>

                <nav className="hidden md:flex items-center space-x-8">
                    <Link href="/pricing" className="text-gray-900 hover:text-gray-500 font-medium">
                        Pricing
                    </Link>
                    <Link href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                        Security
                    </Link>
                    <Link href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                        Compare
                    </Link>
                    <Link href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                        Docs
                    </Link>
                </nav>

                <div className="flex items-center space-x-4">
                    <Link href="/login">
                        <Button variant="ghost" className="text-gray-700 hover:text-gray-900 font-medium">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-full font-medium">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="px-6 py-16 text-center">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-serif text-gray-900 mb-6 leading-tight">
                        Choose Your AI Email Plan
                    </h1>
                    <p className="text-lg md:text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
                        Start saving 6+ hours per week with intelligent email management. Choose the plan that fits your needs.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center space-x-4 mb-12">
                        <span className="text-gray-500">Monthly</span>
                        <div className="relative">
                            <input type="checkbox" id="billing-toggle" className="sr-only" />
                            <label htmlFor="billing-toggle" className="flex items-center cursor-pointer">
                                <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform duration-200"></div>
                                </div>
                            </label>
                        </div>
                        <span className="text-gray-500">
              Yearly
              <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">Save 20%</Badge>
            </span>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="px-6 pb-16">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">
                        {plans.map((plan, index) => (
                            <Card
                                key={plan.name}
                                className={`relative bg-white border-2 ${
                                    plan.popular ? "border-black shadow-lg scale-105" : "border-gray-200 hover:border-gray-300"
                                } transition-all duration-200`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                        <Badge className="bg-black text-white px-4 py-1">Most Popular</Badge>
                                    </div>
                                )}

                                <CardHeader className="text-center pb-4">
                                    <h3 className="text-2xl font-serif text-gray-900 mb-2">{plan.name}</h3>
                                    <p className="text-gray-500 text-sm mb-6">{plan.description}</p>

                                    <div className="mb-6">
                                        <div className="text-4xl font-bold text-gray-900 mb-1">{plan.price}</div>
                                        <div className="text-gray-500 text-sm">{plan.period}</div>
                                    </div>

                                    <Button
                                        onClick={() => plan.name === "Enterprise" ? 
                                            window.location.href = "mailto:sales@example.com" : 
                                            handleSubscriptionPurchase(plan.name)}
                                        className={`w-full h-12 rounded-lg font-medium ${
                                            plan.popular
                                                ? "bg-black hover:bg-gray-800 text-white"
                                                : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                                        }`}
                                    >
                                        {plan.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                                    </Button>
                                </CardHeader>

                                <CardContent>
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-gray-900 text-sm">What's included:</h4>
                                        {plan.features.map((feature, featureIndex) => (
                                            <div key={featureIndex} className="flex items-start space-x-3">
                                                <Check className="w-5 h-5  mt-0.5 flex-shrink-0" />
                                                <span className="text-gray-700 text-sm">{feature}</span>
                                            </div>
                                        ))}

                                        {plan.notIncluded.length > 0 && (
                                            <>
                                                <h4 className="font-semibold text-gray-900 text-sm mt-6">Not included:</h4>
                                                {plan.notIncluded.map((feature, featureIndex) => (
                                                    <div key={featureIndex} className="flex items-start space-x-3">
                                                        <X className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                        <span className="text-gray-500 text-sm">{feature}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="px-6 py-16 border-t border-gray-200">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-serif text-gray-900 text-center mb-12">Frequently Asked Questions</h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h3>
                            <p className="text-gray-500 text-sm">
                                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
                            <p className="text-gray-500 text-sm">
                                All plans come with a 7-day free trial. No credit card required to start.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">What email providers do you support?</h3>
                            <p className="text-gray-500 text-sm">We support Gmail, Outlook, and most IMAP/SMTP email providers.</p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">How secure is my data?</h3>
                            <p className="text-gray-500 text-sm">
                                We use enterprise-grade encryption and never store your email content permanently.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="px-6 py-16 text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-3xl font-serif text-gray-900 mb-4">Ready to Transform Your Email?</h2>
                    <p className="text-gray-500 mb-8">
                        Join thousands of professionals who save hours every week with AI-powered email management.
                    </p>
                    <Link href="/register">
                        <Button className="bg-black hover:bg-gray-800 text-white px-8 py-4 text-sm rounded-full font-medium">
                            Start Your Free Trial
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    )
}

