// components/personalized-sections.tsx
"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "./product-card"
import { TrendingUp, ArrowRight } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId } from "@/lib/interaction-tracker"
import { getSmartRecommendations } from "@/lib/recommendation-service"
import Link from "next/link"

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

  useEffect(() => {
    checkInteractionHistory()
    loadPersonalizedSections()
  }, [user])

  async function checkInteractionHistory() {
    // Check if user has enough interaction history to show recommendations
    try {
      const { getRecentProductIds } = await import("@/lib/interaction-tracker")
      const recentIds = getRecentProductIds(3) // Need at least 3 interactions
      setHasInteractionHistory(recentIds.length >= 3)
    } catch (error) {
      setHasInteractionHistory(false)
    }
  }

  async function loadPersonalizedSections() {
    setLoading(true)

    try {
      // Use smart caching service instead of direct API calls
      const { products: productNames, source } = await getSmartRecommendations(12)

      console.log(`[PersonalizedSections] Recommendations from ${source}`)

      if (!productNames || productNames.length === 0) {
        // No recommendations available
        setSections([])
        return
      }

      // Fetch product details for recommended products
      const recommendedProducts = await fetchProductDetails(productNames)

      // Only show if we have products AND user has interaction history
      // This prevents showing recommendations to brand-new users
      if (recommendedProducts.length > 0 && hasInteractionHistory) {
        // Limit to 6 products max on homepage (prevents clutter)
        const limitedProducts = recommendedProducts.slice(0, 6)

        setSections([
          {
            title: "For You",
            subtitle: "Based on your browsing",
            icon: <TrendingUp className="h-5 w-5" />,
            products: limitedProducts,
            loading: false,
          },
        ])
      } else if (recommendedProducts.length > 0 && !hasInteractionHistory) {
        // New user - show trending but limit to 6
        const limitedProducts = recommendedProducts.slice(0, 6)
        setSections([
          {
            title: "Trending Now",
            subtitle: "Popular this week",
            icon: <TrendingUp className="h-5 w-5" />,
            products: limitedProducts,
            loading: false,
          },
        ])
      } else {
        // No products available
        setSections([])
      }
    } catch (error) {
      console.error("Error loading personalized sections:", error)
      setSections([])
    } finally {
      setLoading(false)
    }
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
        const trendingProducts = await fetchProductDetails(data.products)
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
              image: p.IMAGE_URL || p.image || undefined,
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
            {/* "See More" link to discover page */}
            <Link
              href="/discover"
              className="text-sm text-primary hover:underline flex items-center gap-1 hidden sm:flex"
            >
              See More
              <ArrowRight className="h-4 w-4" />
            </Link>
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


