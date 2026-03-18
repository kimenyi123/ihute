// components/personalized-sections.tsx
"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { ProductCard } from "./product-card"
import { TrendingUp, ArrowRight, Store } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId } from "@/lib/interaction-tracker"
import { getSmartRecommendations, shuffle } from "@/lib/recommendation-service"
import { useProductFiltersStore } from "@/lib/product-filters-store"
import Link from "next/link"

/** Brand id -> label for name matching (same as product-filters-sheet BRANDS). */
const BRAND_LABELS: Record<string, string> = {
  heineken: "Heineken",
  leffe: "Leffe",
  primus: "Primus",
  mutzig: "Mutzig",
  "coca-cola": "Coca-Cola",
  pepsi: "Pepsi",
}

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
  /** From niki_items.item_fabricant — use for brand filter when present */
  brand?: string
  /** From niki_items.bus_category_id (e.g. BAR, LIQUOR STORE) — use for sector filter */
  sector?: string
  /** From niki_items.category_id (e.g. Beer) — use for category filter when present */
  categoryId?: string
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
  const { sector, category, brand, priceMin, priceMax, hasActiveFilters } = useProductFiltersStore()
  const [sections, setSections] = useState<PersonalizedSection[]>([])
  const [loading, setLoading] = useState(true)
  const [hasInteractionHistory, setHasInteractionHistory] = useState(false)

  const hasInteractionRef = useRef(false)
  const priceMinNum = parseInt(priceMin, 10) || 0
  const priceMaxNum = parseInt(priceMax, 10) || 0

  useEffect(() => {
    console.log("[PersonalizedSections] useEffect: mount or user changed", { user: user?.email ?? "anonymous" })
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
      console.log("[PersonalizedSections] checkInteractionHistory:", { recentCount: recentIds.length, hasHistory: has, recentIds: recentIds.slice(0, 5) })
    } catch (e) {
      hasInteractionRef.current = false
      setHasInteractionHistory(false)
      console.log("[PersonalizedSections] checkInteractionHistory: failed", e)
    }
  }

  /** Map niki_items.bus_category_id to app sector slugs (product-filters-sheet). */
  const BUS_CATEGORY_TO_SECTOR_SLUG: Record<string, string> = {
    BAR: "bar-resto",
    RESTAURANT: "bar-resto",
    "LIQUOR STORE": "liquor-store",
    PHARMACY: "pharmacy",
    SUPERMARKET: "supermarket",
    BOUTIQUE: "boutique",
    "COFFEE-SHOP": "coffee-shop",
    BEAUTY: "beauty",
    GENERAL: "general",
  }

  /** Client-side filter: prefer niki_items (brand, category_id, bus_category_id) when present; else fall back to name/category text. */
  function productMatchesFilters(
    p: Product,
    sector: string,
    category: string,
    brand: string,
    priceMinNum: number,
    priceMaxNum: number
  ): boolean {
    if (priceMinNum > 0 && p.price < priceMinNum) return false
    if (priceMaxNum > 0 && p.price > priceMaxNum) return false
    const name = (p.name ?? "").toLowerCase()
    const cat = (p.category ?? "").toString().toLowerCase()
    const catId = (p.categoryId ?? "").toString().toLowerCase()
    const searchable = [name, cat, catId].join(" ")

    if (category.trim()) {
      const slug = category.trim().toLowerCase()
      if (p.categoryId != null && p.categoryId !== "") {
        if (catId !== slug && !catId.includes(slug) && !slug.includes(catId)) return false
      } else if (!searchable.includes(slug) && !name.includes(slug)) return false
    }
    if (brand.trim()) {
      const label = BRAND_LABELS[brand.trim().toLowerCase()] ?? brand.trim()
      if (p.brand != null && p.brand !== "") {
        if (p.brand.toLowerCase() !== label.toLowerCase() && !p.brand.toLowerCase().includes(label.toLowerCase())) return false
      } else if (!label || !name.includes(label.toLowerCase())) return false
    }
    if (sector.trim()) {
      const wantedSlug = sector.trim().toLowerCase()
      if (p.sector != null && p.sector !== "") {
        const productSectorSlug = BUS_CATEGORY_TO_SECTOR_SLUG[p.sector.toUpperCase()] ?? p.sector.toLowerCase().replace(/\s+/g, "-")
        if (productSectorSlug !== wantedSlug) return false
      } else {
        const sectorKeywords: Record<string, string[]> = {
          "liquor-store": ["beer", "wine", "liquor", "leffe", "heineken", "desperados", "corona", "vodka"],
          pharmacy: ["drug", "medicine", "pharma"],
          "bar-resto": ["beer", "wine", "liquor", "drink"],
          supermarket: ["food", "beverage", "household"],
          "coffee-shop": ["coffee", "tea"],
          boutique: ["cosmetic", "beauty"],
          beauty: ["cosmetic", "beauty"],
          general: [],
        }
        const keywords = sectorKeywords[wantedSlug] ?? [wantedSlug.replace(/-/g, " ")]
        if (keywords.length && !keywords.some((k) => searchable.includes(k))) return false
      }
    }
    return true
  }

  /** Extract numeric price from any backend field (same logic as shop-with-me). */
  function extractNumericPrice(value: any): number {
    if (typeof value === "number") return isNaN(value) ? 0 : value
    const n = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".")
    const parsed = parseFloat(n)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const sectionsWithFilters = useMemo(() => {
    if (!hasActiveFilters()) return sections
    return sections.map((sec) => ({
      ...sec,
      products: sec.products.filter((p) =>
        productMatchesFilters(p, sector, category, brand, priceMinNum, priceMaxNum)
      ),
    }))
  }, [sections, sector, category, brand, priceMinNum, priceMaxNum])

  /** Single fast request: load Burrows products with images (shop-with-me). */
  async function fetchBurrowsProducts(limit = 6): Promise<Product[]> {
    console.log("[PersonalizedSections] fetchBurrowsProducts: start", { limit })
    try {
      const res = await fetch(
        `/api/shop-with-me?nickname=${encodeURIComponent(BURROWS_NICKNAME)}`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
      )
      console.log("[PersonalizedSections] fetchBurrowsProducts: response", { status: res.status, ok: res.ok })
      if (!res.ok) return []
      const data = await res.json()
      const sellers = data.sellers || []
      console.log("[PersonalizedSections] fetchBurrowsProducts: sellers count", sellers.length)
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
          // Match shop-with-me price extraction so Burrows always gets a numeric price
          const rawPrice =
            p.selling_price ??
            p.price ??
            p.item_emballage ??
            p.SALE_PRICE_INCLUSIVE ??
            (p as any).SALE_PRICE_EXCLUSIVE ??
            (p as any).PRICE
          const price = extractNumericPrice(rawPrice)
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
            brand: (p as any).item_fabricant ?? (p as any).brand,
            sector: (p as any).bus_category_id ?? (p as any).sector,
            categoryId: (p as any).category_id ?? (p as any).categoryId,
            inStock: true,
          })
        }
      }
      const out = products.slice(0, limit)
      console.log("[PersonalizedSections] fetchBurrowsProducts: done", { productCount: out.length, productNames: out.map((p) => p.name) })
      return out
    } catch (e) {
      console.warn("[PersonalizedSections] fetchBurrowsProducts: failed", e)
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
    console.log("[PersonalizedSections] loadPersonalizedSections: start")
    setLoading(true)

    // 1) Load Burrows first (one fast request with images) so the page shows content quickly
    const burrowsProducts = await fetchBurrowsProducts(6)
    console.log("[PersonalizedSections] loadPersonalizedSections: Burrows result", { count: burrowsProducts.length })
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
      console.log("[PersonalizedSections] loadPersonalizedSections: set sections (Burrows only)")
    } else {
      console.log("[PersonalizedSections] loadPersonalizedSections: no Burrows products, sections stay empty for now")
    }
    setLoading(false)

    // 2) In background: load personalized recommendations and append section when ready
    const hasHistory = hasInteractionRef.current
    console.log("[PersonalizedSections] loadPersonalizedSections: requesting getSmartRecommendations(12), hasHistory:", hasHistory)
    getSmartRecommendations(12)
      .then(async ({ products: productNames, source }) => {
        console.log("[PersonalizedSections] getSmartRecommendations resolved", { source, productNamesCount: productNames?.length ?? 0, productNames: productNames?.slice(0, 6) })
        if (!productNames?.length) {
          console.log("[PersonalizedSections] no recommendation names, skipping For You / Trending section")
          return
        }
        const recommendedProducts = await fetchProductDetails(productNames)
        console.log("[PersonalizedSections] fetchProductDetails done", { requested: productNames.length, resolved: recommendedProducts.length, names: recommendedProducts.map((p) => p.name) })
        if (recommendedProducts.length === 0) {
          console.log("[PersonalizedSections] no resolved products, skipping For You / Trending section")
          return
        }
        const limited = recommendedProducts.slice(0, 6)
        const sectionTitle = hasHistory ? "For You" : "Trending Now"
        console.log("[PersonalizedSections] appending section", { title: sectionTitle, productCount: limited.length })
        setSections((prev) => {
          const next = prev.filter((s) => !s.title.startsWith("For You") && !s.title.startsWith("Trending Now"))
          next.push({
            title: sectionTitle,
            subtitle: hasHistory ? "Based on your browsing" : "Popular this week",
            icon: <TrendingUp className="h-5 w-5" />,
            products: limited,
            loading: false,
          })
          return next
        })
      })
      .catch((err) => {
        console.error("[PersonalizedSections] getSmartRecommendations / fetchProductDetails error:", err)
      })
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
    console.log("[PersonalizedSections] fetchProductDetails: start", { count: productNames.length, names: productNames.slice(0, 6) })
    if (productNames.length === 0) return []

    try {
      // Search for products by name using fetchSuggestions API
      const allProducts: Product[] = []
      const seenIds = new Set<string>()
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

          if (!res.ok) {
            console.log("[PersonalizedSections] fetchProductDetails: search failed for", productName, res.status)
            continue
          }

          const data = await res.json()
          const products = data.products || []
          if (products.length === 0) {
            console.log("[PersonalizedSections] fetchProductDetails: no products for", productName)
          }

          // Map to Product interface
          for (const p of products) {
            const productId = p.ITEM_CODE || p.item_code || p.id || `${productName}-${i}`

            // Skip if we've already seen this product
            if (seenIds.has(productId)) continue
            seenIds.add(productId)
            
            const price = parseFloat(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.price ?? "0")
            const rawCategory = p.FAMILLE || p.famille || p.category || ""
            
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
              category: rawCategory ? String(rawCategory) : undefined,
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
      console.log("[PersonalizedSections] fetchProductDetails: collected", { total: allProducts.length, limited: limited.length })

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
          if (filtered.length > 0) {
            console.log("[PersonalizedSections] fetchProductDetails: filtered by dominant category", { mainCategory, count: filtered.length })
            return filtered
          }
        }
      }

      return limited
    } catch (error) {
      console.error("[PersonalizedSections] fetchProductDetails: error", error)
      return []
    }
  }

  if (loading) {
    console.log("[PersonalizedSections] render: loading")
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">Loading personalized recommendations...</div>
      </div>
    )
  }

  if (sections.length === 0) {
    console.log("[PersonalizedSections] render: no sections, return null")
    return null // Don't show anything if no sections
  }

  console.log("[PersonalizedSections] render: sections", sections.length, sections.map((s) => ({ title: s.title, productCount: s.products.length })))

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
      {sectionsWithFilters.map((section, idx) => (
        <section key={idx} className="container mx-auto px-4">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="text-primary">{section.icon}</div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">{section.title}</h2>
                {section.subtitle && (
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{section.subtitle}</p>
                )}
              </div>
            </div>
            {hasActiveFilters() && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {sector && <span className="rounded bg-muted px-2 py-0.5">Sector: {sector}</span>}
                {category && <span className="rounded bg-muted px-2 py-0.5">Category: {category}</span>}
                {brand && <span className="rounded bg-muted px-2 py-0.5">Brand: {BRAND_LABELS[brand] ?? brand}</span>}
                {(priceMin || priceMax) && (
                  <span className="rounded bg-muted px-2 py-0.5">
                    {priceMin || "0"}–{priceMax || "∞"} RWF
                  </span>
                )}
              </div>
            )}
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                {section.products.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
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
              {hasActiveFilters() ? (
                <>
                  <p className="font-medium">No products match your filters.</p>
                  <Link href="/search" className="mt-2 inline-block text-sm text-primary hover:underline">
                    Try search or clear filters
                  </Link>
                </>
              ) : (
                "No products available in this section"
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}


