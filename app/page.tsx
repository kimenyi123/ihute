"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { CategoryGrid } from "@/components/category-grid"
import { HeroSection } from "@/components/hero-section"
import { Footer } from "@/components/footer"
import { ChatSupport } from "@/components/chat-support"
import { StatsSection } from "@/components/stats-section"
import { PaymentMethods } from "@/components/payment-methods"
import { CTASection } from "@/components/cta-section"
import { PartnersSection } from "@/components/partners-section"
import { Toaster } from "@/components/ui/toaster"
import { useAuthStore } from "@/lib/auth-store"

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Redirect admin users to dashboard if they try to access landing page
    if (isAuthenticated && user?.role === "admin") {
      router.replace("/admin/dashboard")
    }
  }, [isAuthenticated, user, router])

  // Don't render landing page content if admin is logged in
  if (isAuthenticated && user?.role === "admin") {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <CategoryGrid />
        <PaymentMethods />
        <PartnersSection />
        <CTASection />
        <Toaster />
      </main>
      <Footer />
      <ChatSupport />
    </div>
  )
}
