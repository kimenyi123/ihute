// components/personalized-sections.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { ProductCard } from "./product-card"
import { TrendingUp, ArrowRight, Store } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId } from "@/lib/interaction-tracker"
import { getSmartRecommendations, shuffle } from "@/lib/recommendation-service"
import Link from "next/link"

const BURROWS_NICKNAME = "burrows"
const BURROWS_DISPLAY_NAME = "PANGOLIN'S BURROWS"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  unit?: string
  image?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  category?: string
  inStock?: boolean
  rating?: number
}

interface PersonalizedSection {
  title: string
  subtitle?: string
  icon: React.ReactNode
  products: Product[]
  loading: boolean
}

/**
 * Personalized Homepage Section - Trending Now
 * 
 * Smart visibility rules (based on e-commerce best practices):
 * - Shows only if user has browsing history (3+ interactions)
 * - Limited to 6 products max on homepage (prevents clutter)
 * - "See More" link to /discover page for full recommendations
 * - Hides completely for new users (no history)
 * 
 * Clean, minimal UI - only shows products, no suppliers or categories
 */
export function PersonalizedSections() {
  const { user } = useAuthStore()
  const [sections, setSections] = useState<PersonalizedSection[]>([])
  const [loading, setLoading] = useState(true)
  const [hasInteractionHistory, setHasInteractionHistory] = useState(false)

  const hasInteractionRef = useRef(false)

  useEffect(() => {
    checkInteractionHistory().then(() => {
      loadPersonalizedSections()
    })
  }, [user])

  async function checkInteractionHistory() {
    try {
      const { getRecentProductIds } = await import("@/lib/interaction-tracker")
      const recentIds = getRecentProductIds(3)
      const has = recentIds.length >= 3
      hasInteractionRef.current = has
      setHasInteractionHistory(has)
    } catch {
      hasInteractionRef.current = false
      setHasInteractionHistory(false)
    }
  }

  /** Single fast request: load Burrows products with images (shop-with-me). */
  async function fetchBurrowsProducts(limit = 6): Promise<Product[]> {
    try {
      const res = await fetch(
        `/api/shop-with-me?nickname=${encodeURIComponent(BURROWS_NICKNAME)}`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
      )
      if (!res.ok) return []
      const data = await res.json()
      const sellers = data.sellers || []
      const products: Product[] = []
      const seen = new Set<string>()
      for (const seller of sellers) {
        const list = seller.products || []
        const supplierName = seller.OWNER || seller.supplier_name || BURROWS_DISPLAY_NAME
        const supplierId = seller.ISHYIGA_ACCOUNT || seller.supplier_account || ""
        for (const p of list) {
          if (products.length >= limit) break
          const code = p.item_code || p.ITEM_CODE || p.item_commercial_name || ""
          if (seen.has(code)) continue
          seen.add(code)
          const price = parsePrice(p.item_emballage ?? p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? "0")
          if (price <= 0) continue
          const img = p.image_url ?? p.item_image_url ?? p.image ?? p.IMAGE_URL
          products.push({
            id: code || `burrows-${products.length}`,
            name: p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "Product",
            description: undefined,
            price,
            unit: p.item_packet ?? p.UNIT ?? "",
            image: typeof img === "string" ? img : undefined,
            supplierId,
            supplierName,
            supplierLocation: seller.loc_cell ?? seller.supplier_location ?? "",
            momo: seller.momo ?? p.momo,
            category: p.famille ?? p.FAMILLE ?? p.item_department,
            inStock: true,
          })
        }
      }
      return products.slice(0, limit)
    } catch (e) {
      console.warn("[PersonalizedSections] Burrows fetch failed:", e)
      return []
    }
  }

  function parsePrice(val: string | number): number {
    if (typeof val === "number") return isNaN(val) ? 0 : val
    const s = String(val).replace(/[^\d.,-]/g, "").replace(",", ".")
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
  }

  async function loadPersonalizedSections() {
    setLoading(true)

    // 1) Load Burrows first (one fast request with images) so the page shows content quickly
    const burrowsProducts = await fetchBurrowsProducts(6)
    if (burrowsProducts.length > 0) {
      setSections([
        {
          title: `From ${BURROWS_DISPLAY_NAME}`,
          subtitle: "Menu favorites with images",
          icon: <Store className="h-5 w-5" />,
          products: burrowsProducts,
          loading: false,
        },
      ])
    }
    setLoading(false)

    // 2) In background: load personalized recommendations and append section when ready
    const hasHistory = hasInteractionRef.current
    getSmartRecommendations(12)
      .then(async ({ products: productNames, source }) => {
        if (!productNames?.length) return
        console.log(`[PersonalizedSections] Recommendations from ${source}`)
        const recommendedProducts = await fetchProductDetails(productNames)
        if (recommendedProducts.length === 0) return
        const limited = recommendedProducts.slice(0, 6)
        setSections((prev) => {
          const next = prev.filter((s) => !s.title.startsWith("For You") && !s.title.startsWith("Trending Now"))
          next.push({
            title: hasHistory ? "For You" : "Trending Now",
            subtitle: hasHistory ? "Based on your browsing" : "Popular this week",
            icon: <TrendingUp className="h-5 w-5" />,
            products: limited,
            loading: false,
          })
          return next
        })
      })
      .catch((err) => console.error("Error loading personalized sections:", err))
  }

  async function loadTrendingSections() {
    try {
      // Fetch trending products with cache-busting
      const params = new URLSearchParams()
      params.set("action", "getRecommendations")
      params.set("limit", "12")
      params.set("_t", Date.now().toString())

      const res = await fetch(`/api/personalization/recommendations?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      })
      const data = await res.json()

      if (data.ok && data.products) {
        const list = Array.isArray(data.products) ? data.products : []
        const trendingProducts = await fetchProductDetails(shuffle(list))
        // Limit to 6 products max
        const limitedProducts = trendingProducts.slice(0, 6)

        if (limitedProducts.length > 0) {
          setSections([
            {
              title: "Trending Now",
              subtitle: "Popular this week",
              icon: <TrendingUp className="h-5 w-5" />,
              products: limitedProducts,
              loading: false,
            },
          ])
        }
      }
    } catch (error) {
      console.error("Error loading trending:", error)
      setSections([])
    }
  }


  async function fetchProductDetails(productNames: string[]): Promise<Product[]> {
    if (productNames.length === 0) return []

    try {
      // Search for products by name using fetchSuggestions API
      // We'll search for each product name and collect unique results
      const allProducts: Product[] = []
      const seenIds = new Set<string>()

      // Search for up to 12 products (limit to avoid too many requests)
      const searchLimit = Math.min(productNames.length, 12)

      for (let i = 0; i < searchLimit; i++) {
        const productName = productNames[i]?.trim()
        if (!productName) continue

        try {
          const res = await fetch(
            `/api/fetchSuggestions?globalSearch=${encodeURIComponent(productName)}&limit=3&Currency=RWF&_t=${Date.now()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
              },
            }
          )

          if (!res.ok) continue

          const data = await res.json()
          const products = data.products || []

          // Map to Product interface
          for (const p of products) {
            const productId = p.ITEM_CODE || p.item_code || p.id || `${productName}-${i}`

            // Skip if we've already seen this product
            if (seenIds.has(productId)) continue
            seenIds.add(productId)
            
            const price = parseFloat(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.price ?? "0")
            
            allProducts.push({
              id: productId,
              name: p.ITEM_NAME || p.item_commercial_name || p.name || productName,
              description: undefined, // hide code from UI
              price: isNaN(price) ? 0 : price,
              unit: p.UNIT || p.item_packet || "",
              image: p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? p.image ?? undefined,
              supplierId: p.SELLER_ISHYIGA_ACCOUNT || p.item_seller_account || "",
              supplierName: p.SELLER_NAMES || p.supplier_name || "",
              supplierLocation: p.LOCATION || p.supplier_location || "",
              momo: p.momo || undefined,
              category: category || undefined,
              inStock: true,
            })

            // Stop after finding one match per product name
            break
          }
        } catch (error) {
          console.warn(`Error searching for product "${productName}":`, error)
          // Continue to next product
        }
      }

      const limited = allProducts.slice(0, 12)

      // Prefer keeping personalized sections within a dominant category
      if (limited.length > 0) {
        const counts: Record<string, number> = {}
        for (const p of limited) {
          const cat = (p.category || "").trim()
          if (!cat) continue
          counts[cat] = (counts[cat] || 0) + 1
        }
        const mainCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (mainCategory) {
          const filtered = limited.filter((p) => (p.category || "").trim() === mainCategory)
          if (filtered.length > 0) return filtered
        }
      }

      return limited
    } catch (error) {
      console.error("Error fetching product details:", error)
      return []
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">Loading personalized recommendations...</div>
      </div>
    )
  }

  if (sections.length === 0) {
    return null // Don't show anything if no sections
  }

  /**
   * WHEN PRODUCTS REFRESH/DISAPPEAR:
   * 
   * Products refresh automatically when:
   * 1. User logs in/out (user state changes) - triggers useEffect
   * 2. User navigates away and back to homepage (component remounts)
   * 3. Page is refreshed/reloaded (full reload)
   * 
   * Products DON'T auto-refresh while user is browsing (prevents annoying changes)
   * Products update based on new interactions on next page load/visit
   * 
   * This ensures stable UI - products stay visible while browsing, 
   * but update when user returns or logs in/out.
   */

  return (
    <div className="py-8 bg-slate-50/50">
      {sections.map((section, idx) => (
        <section key={idx} className="container mx-auto px-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-primary">{section.icon}</div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">{section.title}</h2>
                {section.subtitle && (
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{section.subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {section.title.includes(BURROWS_DISPLAY_NAME) && (
                <Link
                  href={`/shop-with-me/${BURROWS_NICKNAME}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Browse full menu
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                href="/discover"
                className="text-sm text-primary hover:underline flex items-center gap-1 hidden sm:flex"
              >
                See More
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {section.products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {section.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {/* Mobile "See More" link */}
              <div className="mt-4 text-center sm:hidden">
                <Link
                  href="/discover"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  See More Recommendations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No products available in this section
            </div>
          )}
        </section>
      ))}
    </div>
  )
}


