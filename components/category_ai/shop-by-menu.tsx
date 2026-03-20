"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { CategoryGridAI } from "./category-grid-ai"
import { CategoryListAI } from "./category-list-ai"
import { ShopsBySector } from "./shops-by-sector"
import { BrandListAI } from "./brand-list-ai"
import { BestDealsSection } from "./best-deals-section"
import { PersonalizedSections } from "@/components/personalized-sections"
import { useProductFiltersStore } from "@/lib/product-filters-store"

export type ShopByTab = "sector" | "category" | "shops" | "brand" | "all" | "opportunities" | "manufacturers" | "high-margin" | "high-demand"

/** All tabs use icons: Sector, Category, Shops (store icons), Brand, All items, etc. */
const EMOJI = (char: string) => <span className="text-base leading-none" aria-hidden>{char}</span>
const TABS: { id: ShopByTab; label: string; icon: React.ReactNode }[] = [
  { id: "sector", label: "Sector", icon: EMOJI("🏭") },
  { id: "category", label: "Category", icon: EMOJI("🔲") },
  { id: "shops", label: "Shops", icon: EMOJI("🏪") },
  { id: "brand", label: "Brand", icon: EMOJI("🏷️") },
  { id: "all", label: "All items", icon: EMOJI("📦") },
  { id: "opportunities", label: "Smart Picks", icon: EMOJI("⚡") },
  { id: "manufacturers", label: "Trending Near You", icon: EMOJI("🏭") },
  { id: "high-margin", label: "Best Deals", icon: EMOJI("💰") },
  { id: "high-demand", label: "Running Out Fast", icon: EMOJI("📈") },
]

const VALID_SHOP_BY: ShopByTab[] = ["sector", "category", "shops", "brand", "all", "opportunities", "manufacturers", "high-margin", "high-demand"]

/**
 * Menu bar: Shop by [Sector | Category | Brand | All items].
 * Selection is persisted in URL (?shopBy=) and in store so search/filters remember context.
 */
export function ShopByMenu() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setShopByInStore = useProductFiltersStore((s) => s.setShopBy)

  const urlTab = searchParams.get("shopBy")
  const initialTab: ShopByTab = VALID_SHOP_BY.includes(urlTab as ShopByTab) ? (urlTab as ShopByTab) : "sector"
  const [activeTab, setActiveTab] = useState<ShopByTab>(initialTab)

  useEffect(() => {
    if (VALID_SHOP_BY.includes(urlTab as ShopByTab) && urlTab !== activeTab) {
      setActiveTab(urlTab as ShopByTab)
    }
  }, [urlTab])

  const handleTabChange = (tab: ShopByTab) => {
    setActiveTab(tab)
    setShopByInStore(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set("shopBy", tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <nav
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b"
        aria-label="Shop by"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm font-medium text-muted-foreground mr-2 flex items-center gap-1.5" aria-hidden>
              <span className="text-base leading-none">🛍️</span>
              Shop by:
            </span>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-pressed={activeTab === tab.id}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4">
        {activeTab === "sector" && <CategoryGridAI showHeading={false} />}
        {activeTab === "category" && <CategoryListAI />}
        {activeTab === "shops" && <ShopsBySector />}
        {activeTab === "brand" && <BrandListAI />}
        {activeTab === "all" && <PersonalizedSections />}
        {activeTab === "high-margin" && <BestDealsSection />}
        {(activeTab === "opportunities" || activeTab === "manufacturers" || activeTab === "high-demand") && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-medium">
              {activeTab === "opportunities" && "⚡ Smart Picks"}
              {activeTab === "manufacturers" && "🏭 Trending Near You"}
              {activeTab === "high-demand" && "📈 Running Out Fast"}
            </p>
            <p className="mt-2 text-sm">Coming soon. Content will be wired when backend is ready.</p>
          </div>
        )}
      </div>
    </div>
  )
}
