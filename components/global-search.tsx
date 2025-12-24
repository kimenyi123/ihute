// components/global-search.tsx
"use client"

import { useEffect, useRef, useState, KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Search, Package, Store, Clock, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { usePrefsStore } from "@/lib/prefs-store"
import { useCartStore } from "@/lib/cart-store"
import { filterSuppliersByRelevance, filterProductsByRelevance } from "@/lib/search-utils"
import { useAuthStore } from "@/lib/auth-store"
import { getRecentSearches, recordSearch, markSearchClick, clearLocalSearchHistory } from "@/lib/search-intent-tracker"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"

export interface GlobalResult {
  type?: "product" | "supplier"
  item_code?: string
  item_commercial_name?: string
  item_packet?: string
  item_emballage?: string
  item_key_words?: string
  item_seller_account?: string
  supplier_account?: string
  supplier_name?: string
  supplier_location?: string
  momo?: string
  match_type?: "product" | "supplier" | "name"
  match_score?: number
  relevance_score?: number
  finalScore?: number
  image?: string
  product_count?: number
  source?: string
  cache_hit?: boolean
}

type GlobalSearchResponse = {
  suppliersByName: GlobalResult[]
  suppliersByProduct: GlobalResult[]
  products: GlobalResult[]
  query: string
  timestamp?: number
  error?: string
  searchStats?: {
    totalProducts: number
    totalSuppliers: number
    dataSource: string
    cacheHit: boolean
  }
}

function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

// Group products by supplier for better display
function groupProductsBySupplier(products: GlobalResult[]): Map<string, GlobalResult[]> {
  const grouped = new Map<string, GlobalResult[]>()

  products.forEach(p => {
    const supplierId = p.supplier_account || p.item_seller_account || "unknown"
    if (!grouped.has(supplierId)) {
      grouped.set(supplierId, [])
    }
    grouped.get(supplierId)!.push(p)
  })

  return grouped
}

export function GlobalSearch({
  placeholder = "Search products from multiple sellers...",
  className,
  maxSuggestions = 15,
}: {
  placeholder?: string
  className?: string
  maxSuggestions?: number
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [products, setProducts] = useState<GlobalResult[]>([])
  const [suppliers, setSuppliers] = useState<GlobalResult[]>([])
  const [stats, setStats] = useState<GlobalSearchResponse["searchStats"] | null>(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const sector = usePrefsStore((s) => s.sector)
  const location = usePrefsStore((s) => s.location)
  const { user } = useAuthStore()
  const userLocation = useLocationStoreEnhanced((s) => s.location)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const addToCartFn = useCartStore((s: any) => s.addOrInc ?? s.add)

  useEffect(() => {
    setMounted(true)
    // Load recent searches for suggestions
    getRecentSearches(5).then(setRecentSearches).catch(() => {})
  }, [user])

  const addProductAndGoToCart = (p: GlobalResult) => {
    if (!addToCartFn) return
    const id = p.item_code || `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`
    const unit = p.item_packet || ""
    const price = extractNumericPrice(p.item_emballage)

    addToCartFn({
      id,
      name: p.item_commercial_name,
      price,
      unit,
      selectedUnit: unit,
      qty: 1,
      supplierId: p.supplier_account || p.item_seller_account,
      supplierName: p.supplier_name || p.supplier_account || "Supplier",
      supplierLocation: p.supplier_location,
      image: p.image || "/placeholder.svg?height=300&width=300",
      momo: p.momo,
    })
    
    // Track search click for search intent
    if (q.trim()) {
      markSearchClick(
        q.trim(),
        id,
        p.supplier_account || p.item_seller_account
      ).catch(err => console.warn("[SearchIntent] Failed to mark click:", err))
    }
    
    router.push("/cart")
    setOpen(false)
    setQ("")
  }

  useEffect(() => {
    if (!q.trim()) {
      setProducts([])
      setSuppliers([])
      setStats(null)
      setOpen(false)
      return
    }

    const id = setTimeout(async () => {
      setLoading(true)
      setErr(null)

      console.log(`[GlobalSearch] Searching for: "${q}"`)

      try {
      const locationData = useLocationStoreEnhanced.getState().location
      const params = new URLSearchParams({
        globalSearch: q,
        limit: String(maxSuggestions),
        Currency: "RWF",
        ...(sector ? { sector } : {}),
        ...(location ? { location } : {}),
        // Add location-aware parameters (district and cell)
        ...(locationData?.district ? { district: locationData.district } : {}),
        ...(locationData?.cell ? { cell: locationData.cell } : {}),
      }).toString()

        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store",
          headers: { 'Accept': 'application/json' }
        })

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`)
        }

        const json: GlobalSearchResponse = await res.json()

        console.log("[GlobalSearch] Raw response:", {
          products: json.products?.length || 0,
          suppliersByName: json.suppliersByName?.length || 0,
          suppliersByProduct: json.suppliersByProduct?.length || 0,
          stats: json.searchStats
        })

        // Validate response structure
        if (!json.products && !json.suppliersByName && !json.suppliersByProduct) {
          console.warn("[GlobalSearch] Empty response structure:", json)
          setProducts([])
          setSuppliers([])
          setStats(null)
          setOpen(true)
          return
        }

        // Filter products with threshold of 10 for more results with multilingual support
        const allProducts = json.products || []
        const filteredProducts = filterProductsByRelevance(allProducts, q.trim(), 10)

        // Filter suppliers with lower threshold when no products are found
        const allSuppliers = [
          ...(json.suppliersByName || []),
          ...(json.suppliersByProduct || [])
        ]
        // Filter out suppliers without names, then cast to proper type
        const validSuppliers = allSuppliers.filter(s =>
          s.supplier_name
        ) as Array<GlobalResult & { supplier_name: string }>

        // Use lower threshold (8) if we have products, higher (20) if we don't to show suppliers
        const supplierThreshold = filteredProducts.length > 0 ? 8 : 20
        const filteredSuppliers = filterSuppliersByRelevance(validSuppliers, q.trim(), supplierThreshold)

        const p = filteredProducts.slice(0, maxSuggestions)
        const s = filteredSuppliers.slice(0, Math.max(4, Math.floor(maxSuggestions * 0.3)))

        console.log("[GlobalSearch] Filtered results:", {
          products: p.length,
          suppliers: s.length,
          topProductScores: p.slice(0, 3).map(x => x.finalScore)
        })

        setProducts(p)
        setSuppliers(s)
        setStats(json.searchStats || null)
        setOpen(true)
        
        // Track search intent
        if (q.trim().length >= 2) {
          const totalResults = p.length + s.length
          recordSearch(q.trim(), totalResults, "global").catch(err => 
            console.warn("[SearchIntent] Failed to record search:", err)
          )
        }

      } catch (e: any) {
        console.error("[GlobalSearch] Error:", e)
        setErr(e?.message || "Search failed")
        setProducts([])
        setSuppliers([])
        setStats(null)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(id)
  }, [q, maxSuggestions, sector, location])

  // Click outside detection
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (
        !wrapRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const onSubmit = (value: string) => {
    const term = value.trim()
    if (!term) return
    setOpen(false)
    setQ("")
    const sp = new URLSearchParams({
      q: term,
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    }).toString()
    router.push(`/search?${sp}`)
  }

  const onSubmitSupplier = (s: GlobalResult) => {
    const supplierAccount = s.supplier_account || s.item_seller_account
    const supplierName = s.supplier_name || supplierAccount || ""
    const params = new URLSearchParams({
      ...(supplierName ? { q: supplierName } : {}),
      supplier: supplierAccount || "",
      ...(supplierName ? { supplierName } : {}),
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })
    setOpen(false)
    setQ("")
    router.push(`/search?${params.toString()}`)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onSubmit(q)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const getDropdownPosition = () => {
    if (!inputRef.current) return { top: 0, left: 0, width: 0 }
    const rect = inputRef.current.getBoundingClientRect()
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    }
  }

  const dropdownPos = getDropdownPosition()

  // Group products by supplier
  const productsBySupplier = groupProductsBySupplier(products)
  const supplierCount = productsBySupplier.size

  return (
    <>
      <div ref={wrapRef} className={cn("relative w-full", className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          className="pl-10 pr-3 h-9"
        />
      </div>

      {mounted && open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 rounded-md border bg-popover text-popover-foreground shadow-lg"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            maxWidth: "90vw",
            maxHeight: "60vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
              Searching…
            </div>
          )}

          {err && !loading && (
            <div className="px-3 py-2 text-sm text-destructive">{err}</div>
          )}

          {/* Recent Searches Suggestions */}
          {!loading && !err && q.trim().length === 0 && recentSearches.length > 0 && (
            <div className="p-3 space-y-2">
              <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent Searches
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearLocalSearchHistory()
                    setRecentSearches([])
                  }}
                  className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                  title="Clear search history"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 rounded-lg border hover:border-blue-300 hover:bg-accent transition-colors text-sm"
                    onClick={() => {
                      setQ(search)
                      onSubmit(search)
                    }}
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && !err && (products.length > 0 || suppliers.length > 0) && (
            <div className="p-3 space-y-3">
              {/* Search Stats */}
              {stats && (
                <div className="px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {stats.totalProducts} products
                  </span>
                  <span className="flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {supplierCount} suppliers
                  </span>
                  {stats.cacheHit && (
                    <span className="text-green-600">⚡ Cached</span>
                  )}
                </div>
              )}

              {/* Products grouped by supplier */}
              {products.length > 0 && (
                <section>
                  <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                    <span>Products from {supplierCount} seller{supplierCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-3">
                    {Array.from(productsBySupplier.entries()).map(([supplierId, supplierProducts]) => {
                      const firstProduct = supplierProducts[0]
                      return (
                        <div key={supplierId} className="space-y-1">
                          {/* Supplier header */}
                          <div className="text-[11px] font-medium text-gray-600 px-2 py-1 bg-gray-50 rounded flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {firstProduct.supplier_name || supplierId}
                            {firstProduct.supplier_location && (
                              <span className="text-gray-500">• {firstProduct.supplier_location}</span>
                            )}
                            <span className="ml-auto text-blue-600">
                              {supplierProducts.length} product{supplierProducts.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Products from this supplier */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {supplierProducts.map((p, i) => (
                              <button
                                key={`${supplierId}-${p.item_code}-${i}`}
                                className="w-full text-left rounded-lg border p-3 hover:border-blue-300 hover:bg-accent transition-colors group"
                                onClick={() => {
                                  // Track search click
                                  if (q.trim()) {
                                    markSearchClick(
                                      q.trim(),
                                      p.item_code || "",
                                      supplierId
                                    ).catch(err => console.warn("[SearchIntent] Failed to mark click:", err))
                                  }
                                  addProductAndGoToCart(p)
                                }}
                                title="Click to add & go to cart"
                              >
                                <div className="font-medium text-gray-900 group-hover:text-blue-700 text-sm">
                                  {p.item_commercial_name}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {p.item_packet || ""}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-green-600">
                                  {p.item_emballage || "Price N/A"}
                                </div>
                                {p.finalScore && p.finalScore > 0 && (
                                  <div className="mt-1 text-[10px] text-gray-400">
                                    Score: {Math.round(p.finalScore)}
                                  </div>
                                )}
                                <div className="mt-1 text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Add & go to cart →
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Suppliers */}
              {suppliers.length > 0 && (
                <section>
                  <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    More Suppliers
                  </div>
                  <div className="space-y-1">
                    {suppliers.map((s, i) => (
                      <button
                        key={`s-${s.supplier_account}-${i}`}
                        className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-accent transition-colors"
                        onClick={() => {
                          // Track search click for supplier
                          if (q.trim()) {
                            markSearchClick(
                              q.trim(),
                              undefined,
                              s.supplier_account || ""
                            ).catch(err => console.warn("[SearchIntent] Failed to mark click:", err))
                          }
                          onSubmitSupplier(s)
                        }}
                      >
                        <Store className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="font-medium leading-tight">
                            {s.supplier_name || s.supplier_account}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {s.supplier_location || "Location N/A"}
                            {s.product_count && ` • ${s.product_count} products`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {!loading && !err && products.length === 0 && suppliers.length === 0 && (
            <div className="px-3 py-4 text-sm text-center text-muted-foreground">
              No results found for "{q}"
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
