"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ShopByMenu } from "@/components/category_ai/shop-by-menu"

/**
 * Landing page for the enhanced category experience.
 * Hero line + Shop by [Sector | Category | Brand | All items | Smart Picks | Top Manufacturers | High Margin | High Demand].
 * No separate Smart Strip — those concepts live in Shop by (High Demand, High Margin, Top Manufacturers).
 */
export default function CategoryAILandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero line: one sharp line */}
        <div className="border-b bg-muted/20 py-3">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm font-medium text-foreground/90">
              Find anything. Anywhere. Instantly.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Powered by Ishyiga Intelligence
            </p>
          </div>
        </div>
        <div className="py-6">
          <ShopByMenu />
        </div>
      </main>
      <Footer />
    </div>
  )
}
