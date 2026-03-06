"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId } from "@/lib/interaction-tracker"
import { getSmartRecommendations } from "@/lib/recommendation-service"

type RecommendedProduct = {
  id: string
  name?: string
  price?: number
  image?: string
  supplierName?: string
  category?: string
}

type RecommendationType = "similar" | "alsoBought" | "fbt" | "trending"

interface RecommendationCarouselProps {
  title: string
  type: RecommendationType
  productId?: string
  className?: string
}

export function RecommendationCarousel({
  title,
  type,
  productId,
  className,
}: RecommendationCarouselProps) {
  const [items, setItems] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const authStore = useAuthStore()

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        setLoading(true)

        // Use smart recommendation service with caching
        const { products: rawProducts, source, cacheAge } = await getSmartRecommendations(20)

        if (ignore) return

        // Log cache status
        if (source === "cache") {
          console.log(`[RecommendationCarousel] Using cached recommendations (${Math.round((cacheAge || 0) / 1000)}s old)`)
        } else {
          console.log("[RecommendationCarousel] Fresh recommendations from backend")
        }

        if (!rawProducts || rawProducts.length === 0) {
          setItems([])
          return
        }

        // Enrich products with full details
        await enrichProducts(rawProducts)
      } catch (e) {
        console.error("[RecommendationCarousel] Error loading recommendations:", e)
        if (!ignore) setItems([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    async function enrichProducts(rawProducts: string[]) {
      // Enrich product IDs / names into full cards using the existing fetchSuggestions API
      const detailed: RecommendedProduct[] = []
      const seen = new Set<string>()

      const searchLimit = Math.min(rawProducts.length || 0, 12)
      for (let i = 0; i < searchLimit; i++) {
        const q = String(rawProducts[i] ?? "").trim()
        if (!q) continue

        try {
          const resp = await fetch(
            `/api/fetchSuggestions?globalSearch=${encodeURIComponent(q)}&limit=3&Currency=RWF&_t=${Date.now()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
              },
            }
          )
          if (!resp.ok) continue

          const payload = await resp.json()
          const products = payload.products || []

          for (const p of products) {
            const id = String(p.ITEM_CODE || p.item_code || p.id || q)
            if (seen.has(id)) continue
            seen.add(id)

            const price = parseFloat(
              p.SALE_PRICE_INCLUSIVE || p.item_emballage || p.price || "0"
            )
            const category =
              p.FAMILLE ||
              p.famille ||
              p.business_category ||
              p.Business_Category ||
              p.CATEGORY ||
              ""
            detailed.push({
              id,
              name: p.ITEM_NAME || p.item_commercial_name || p.name || q,
              price: isNaN(price) ? undefined : price,
              image: p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? p.image ?? undefined,
              supplierName: p.SELLER_NAMES || p.supplier_name || p.item_seller_name,
              category: category || undefined,
            })
            break
          }
        } catch (e) {
          console.warn("[RecommendationCarousel] Failed to enrich product:", q, e)
        }
      }

      if (ignore) return

      // Prefer a single main category for cart recommendations
      if (detailed.length > 0) {
        const counts: Record<string, number> = {}
        for (const p of detailed) {
          const cat = (p.category || "").trim()
          if (!cat) continue
          counts[cat] = (counts[cat] || 0) + 1
        }
        const mainCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (mainCategory) {
          const filtered = detailed.filter((p) => (p.category || "").trim() === mainCategory)
          if (filtered.length > 0) {
            setItems(filtered)
            return
          }
        }
      }

      setItems(detailed)
    }

    load()

    return () => {
      ignore = true
    }
  }, [type, productId, authStore.user])

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
            <Card
              key={idx}
              className="min-w-[140px] max-w-[160px] shrink-0 p-3 flex flex-col gap-2"
            >
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))
          : items.length === 0
            ? (
              <div className="text-sm text-muted-foreground py-4">
                No recommendations yet. Keep browsing products to see personalized suggestions.
              </div>
            )
            : items.map((p) => (
              <Link key={p.id} href={`/search?q=${encodeURIComponent(p.name || p.id)}`}>
                <Card className="min-w-[140px] max-w-[160px] shrink-0 p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow">
                  <div className="h-24 w-full rounded-md bg-muted overflow-hidden" />
                  <div className="space-y-1">
                    <div className="text-xs font-medium line-clamp-2">{p.name || "Product"}</div>
                    {p.supplierName && (
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {p.supplierName}
                      </div>
                    )}
                    {typeof p.price === "number" && p.price > 0 && (
                      <div className="text-sm font-semibold text-primary">
                        {Math.round(p.price).toLocaleString()} RWF
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
      </div>
    </section>
  )
}


