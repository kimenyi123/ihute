"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { CategoryGrid } from "@/components/category-grid"
import { HeroSection } from "@/components/hero-section"
import { Footer } from "@/components/footer"
import { ChatSupport } from "@/components/chat-support"
import { StatsSection } from "@/components/stats-section"
import { PaymentMethods } from "@/components/payment-methods"
import { CTASection } from "@/components/cta-section"
import { PartnersSection } from "@/components/partners-section"
import { PersonalizedSections } from "@/components/personalized-sections"
import { Toaster } from "@/components/ui/toaster"
import { useAuthStore } from "@/lib/auth-store"
import QuickProductCodePage from "@/components/QuickProductCodePage"

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
    //  Check if quick product code search is active
    const searchParams = useSearchParams()
    const quickCode = searchParams.get('quick_product_code')

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
//  If quick_product_code exists in URL, show search results instead of home page
  if (quickCode) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <QuickProductCodePage />
        </main>
        <Footer />
        <ChatSupport />
        <Toaster />
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <CategoryGrid />
        <PersonalizedSections />
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
