"use client"

import { Header } from "@/components/header"
import { CategoryGrid } from "@/components/category-grid"
import { HeroSection } from "@/components/hero-section"
import { Footer } from "@/components/footer"
import { ChatSupport } from "@/components/chat-support"
import { StatsSection } from "@/components/stats-section"
import { PaymentMethods } from "@/components/payment-methods"
import { CTASection } from "@/components/cta-section"
import { PartnersSection } from "@/components/partners-section"
import { SupplierSearchBar } from "@/components/supplier-search-bar"
import { Toaster } from "@/components/ui/toaster"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <SupplierSearchBar />
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
