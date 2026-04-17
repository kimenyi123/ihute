"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ShopByMenu } from "@/components/category_ai/shop-by-menu"

/** Main buyer “shop by sector” experience (was /category_ai only). */
export function CategoryAIShell() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="py-6">
          <ShopByMenu />
        </div>
      </main>
      <Footer showIshyigaIntelligenceTagline />
    </div>
  )
}
