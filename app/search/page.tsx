// app/search/page.tsx
"use client"

import { useEffect, useMemo, useState, KeyboardEvent } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { filterSuppliersByRelevance } from "@/lib/search-utils"
import { getTranslations } from "@/lib/keyword-mapping"
import { MapPin, Store } from "lucide-react"
import { useTableCommandStore } from "@/lib/table-command-store"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { LocationBadge } from "@/components/location-badge"
import { ProductCard } from "@/components/product-card"

type Shop = {
  supplier_account: string
  supplier_name: string
  supplier_location?: string | null
  type: string
  match_type?: string
  product_count?: number
}

type Product = {
  item_code: string
  item_commercial_name: string
  item_packet?: string
  item_emballage?: string
  item_key_words?: string
  supplier_account?: string
  supplier_name?: string
  supplier_location?: string
  momo?: string
  type: string
  image?: string
  relevance_score?: number
}

type SearchResult = {
  suppliersByName: Shop[]
  suppliersByProduct: Shop[]
  products: Product[]
  query: string
  timestamp?: number
  error?: string
}

type SectorSeller = {
  seller_account: string
  seller_name: string
  seller_location?: string
  seller_momo?: string
  products: Product[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ""
const SECTOR_OPTIONS = [
  "pharmacy",
  "supermarket",
  "boutique",
  "bar-resto",
  "coffee-shop",
  "liquor-store",
  "beauty",
  "general",
]
const QUICK_LOCATIONS = ["Kigali", "Musanze", "Rubavu", "Huye", "Muhanga", "Rusizi"]

// -------- helpers --------
function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

function toCardProduct(p: Product) {
  return {
    id: p.item_code || p.item_key_words || `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`,
    name: p.item_commercial_name || "Product",
    description: undefined, // hide code (item_key_words) from UI
    price: extractNumericPrice(p.item_emballage),
    unit: "", // item_packet is quantity, not a unit label
    inStock: true,
    rating: 4,
    supplierId: p.supplier_account,
    supplierName: p.supplier_name || p.supplier_account || "Supplier",
    supplierLocation: p.supplier_location,
    momo: p.momo,
    image: p.image || "/placeholder.svg?height=300&width=300",
  }
}

/** Normalize supplier products from API. Backend/Redis may return: object with "data" array (Redis: { key, data: [flat products] }), array (flat or with nested .items), or object with .sellers/.products. Flatten to Product[] so names and prices display. */
function normalizeSupplierProductsResponse(
  data: any,
  supplierAccount: string,
  supplierName: string
): Product[] {
  if (!data) return []
  const supplier_account = supplierAccount
  const supplier_name = supplierName

  // Redis shape: { key: "supplier_ALG000017701", data: [ product1, product2, ... ] } — flat array in .data
  if (typeof data === "object" && Array.isArray(data.data)) {
    return normalizeSupplierProductsResponse(data.data, supplierAccount, supplierName)
  }

  if (Array.isArray(data)) {
    const flat: Product[] = []
    for (const p of data) {
      const items = (p as any).items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          flat.push({
            item_code: item.item_key_words ?? item.item_code ?? "",
            item_commercial_name: item.item_commercial_name ?? item.item_name ?? "Product",
            item_packet: item.item_packet,
            item_emballage: item.item_emballage ?? item.price ?? "",
            item_key_words: item.item_key_words,
            supplier_account,
            supplier_name,
            supplier_location: (p as any).supplier_location ?? undefined,
            type: (p as any).type ?? "product",
            image: item.image,
            momo: item.momo ?? (p as any).momo,
          })
        }
      } else {
        flat.push({
          item_code: (p as any).item_key_words ?? (p as any).item_code ?? "",
          item_commercial_name: (p as any).item_commercial_name ?? (p as any).item_name ?? "Product",
          item_packet: (p as any).item_packet,
          item_emballage: (p as any).item_emballage ?? (p as any).price ?? "",
          item_key_words: (p as any).item_key_words,
          supplier_account: (p as any).supplier_account ?? supplier_account,
          supplier_name: (p as any).supplier_name ?? supplier_name,
          supplier_location: (p as any).supplier_location,
          type: (p as any).type ?? "product",
          image: (p as any).image,
          momo: (p as any).momo,
        })
      }
    }
    return flat
  }

  if (typeof data === "object" && Array.isArray(data.sellers)) {
    const seller = data.sellers.find(
      (s: any) => (s.ISHYIGA_ACCOUNT ?? s.seller_account) === supplierAccount
    ) ?? data.sellers[0]
    if (!seller) return []
    const rawProducts = seller.products ?? []
    return normalizeSupplierProductsResponse(
      rawProducts,
      seller.ISHYIGA_ACCOUNT ?? seller.seller_account ?? supplierAccount,
      seller.OWNER ?? seller.SELLER_NAMES ?? seller.seller_name ?? supplierName
    )
  }

  return Array.isArray(data.products) ? normalizeSupplierProductsResponse(data.products, supplierAccount, supplierName) : []
}

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL params (all optional)
  const initialQ = searchParams.get("q") || ""
  const supplierParam = searchParams.get("supplier")
  const supplierNameParam = searchParams.get("supplierName")
  const locationParam = searchParams.get("location") || ""
  const sectorParam = searchParams.get("sector") || ""

  const [q, setQ] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [shopProducts, setShopProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Compact filter bar (draft inputs)
  const [locationDraft, setLocationDraft] = useState(locationParam)
  const [sectorDraft, setSectorDraft] = useState(sectorParam)

  // Sector spotlight data
  const [sectorSellers, setSectorSellers] = useState<SectorSeller[]>([])
  const [loadingSector, setLoadingSector] = useState(false)

  // Supplier product search
  const [supplierSearch, setSupplierSearch] = useState("")
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState("")

  // Table command store
  const {
    activeSession: tableCommand,
    addToTableCart,
    tableCartItems
  } = useTableCommandStore()

  // Keep drafts in sync with URL changes
  useEffect(() => setLocationDraft(locationParam), [locationParam])
  useEffect(() => setSectorDraft(sectorParam), [sectorParam])

  const addToCartFn = useCartStore((s: any) => s.addOrInc ?? s.add)

  const addProductToCart = (p: Product) => {
    if (!addToCartFn) {
      console.warn("Cart store is missing addOrInc/add")
      return
    }

    const id = p.item_code || `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`
    const unit = p.item_packet || ""
    const price = extractNumericPrice(p.item_emballage)
    const supplierId = p.supplier_account || "unknown"
    const supplierName = p.supplier_name || p.supplier_account || "Supplier"

    // Check if we're in a table command context
    if (tableCommand && tableCommand.locationId === p.supplier_account) {
      // Add to table command cart (special handling for table orders)
      if (addToTableCart) {
        addToTableCart({
          id,
          name: p.item_commercial_name,
          price,
          unit,
          selectedUnit: unit,
          qty: 1,
          supplierId,
          supplierName,
          supplierLocation: p.supplier_location,
          image: p.image || "/placeholder.svg?height=300&width=300",
          momo: p.momo || (p as any)?.seller_momo || "",
        })
      } else {
        // Fallback to regular cart
        addToCartFn({
          id,
          name: p.item_commercial_name,
          price,
          unit,
          selectedUnit: unit,
          qty: 1,
          supplierId,
          supplierName,
          supplierLocation: p.supplier_location,
          image: p.image || "/placeholder.svg?height=300&width=300",
          momo: p.momo || (p as any)?.seller_momo || "",
        })
      }
    } else {
      // Regular order (not part of table command)
      addToCartFn({
        id,
        name: p.item_commercial_name,
        price,
        unit,
        selectedUnit: unit,
        qty: 1,
        supplierId,
        supplierName,
        supplierLocation: p.supplier_location,
        image: p.image || "/placeholder.svg?height=300&width=300",
        momo: p.momo || (p as any)?.seller_momo || "",
      })
    }

    // Show success message instead of redirecting
    alert(`Added "${p.item_commercial_name}" to your cart!`)
  }

  const onTileKey = (e: KeyboardEvent<HTMLDivElement>, p: Product) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      addProductToCart(p)
    }
  }

  // Small helper to push URL with preserved params (and real clearing support)
  const pushWith = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()

    if (debouncedQ) params.set("q", debouncedQ)
    if (supplierParam) params.set("supplier", supplierParam)
    if (supplierNameParam) params.set("supplierName", supplierNameParam)

    // location: if explicitly provided in updates, use it (empty string => remove)
    const locProvided = Object.prototype.hasOwnProperty.call(updates, "location")
    const locValue = locProvided ? updates.location : locationParam
    if (locProvided) {
      if (locValue) params.set("location", locValue)
    } else if (locationParam) {
      params.set("location", locationParam)
    }

    // sector: same idea
    const secProvided = Object.prototype.hasOwnProperty.call(updates, "sector")
    const secValue = secProvided ? updates.sector : sectorParam
    if (secProvided) {
      if (secValue) params.set("sector", secValue)
    } else if (sectorParam) {
      params.set("sector", sectorParam)
    }

    router.push(`/search?${params.toString()}`)
  }

  // Sync search input with URL query param on mount and changes
  useEffect(() => {
    const urlQ = searchParams.get("q") || ""
    if (urlQ && urlQ !== q) setQ(urlQ)
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Sync selected shop from URL params
  useEffect(() => {
    if (supplierParam) {
      setSelectedShop({
        supplier_account: supplierParam,
        supplier_name: supplierNameParam || supplierParam,
        type: "supplier",
        supplier_location: null,
      })
    } else {
      setSelectedShop(null)
    }
  }, [supplierParam, supplierNameParam])

  // Supplier search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSupplierSearch(supplierSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [supplierSearch])

  // ====== MAIN FIX: Trust backend translation results ======
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!debouncedQ || debouncedQ.length < 2) {
        setSearchResult(null)
        return
      }
      setLoading(true)
      try {
        const url = new URL(`/api/fetchSuggestions`, window.location.origin)
        url.searchParams.set("globalSearch", debouncedQ)
        url.searchParams.set("Currency", "RWF")
        if (selectedShop?.supplier_account) {
          url.searchParams.set("supplier", selectedShop.supplier_account)
        }
        if (locationParam) {
          url.searchParams.set("location", locationParam)
        }

        // Add location-aware parameters from enhanced location store
        const { useLocationStoreEnhanced } = await import("@/lib/location-store-enhanced")
        const userLocation = useLocationStoreEnhanced.getState().location
        if (userLocation?.district) {
          url.searchParams.set("district", userLocation.district)
        }
        if (userLocation?.cell) {
          url.searchParams.set("cell", userLocation.cell)
        }

        const res = await fetch(url.toString(), { cache: "no-store" })
        const data: SearchResult = res.ok
          ? await res.json()
          : { suppliersByName: [], suppliersByProduct: [], products: [], query: debouncedQ }

        if (!cancelled) {
          // ✅ FIX: Trust backend - it already handles translation!
          // No client-side filtering for products since backend does the work
          const filteredProducts = data.products || []

          // Keep light filtering for suppliers (optional - can be removed if backend handles it)
          const filteredSuppliersByName = filterSuppliersByRelevance(
            data.suppliersByName || [],
            debouncedQ,
            10 // Lower threshold for suppliers
          )

          const filteredSuppliersByProduct = filterSuppliersByRelevance(
            data.suppliersByProduct || [],
            debouncedQ,
            10 // Lower threshold for suppliers
          )

          setSearchResult({
            ...data,
            products: filteredProducts,
            suppliersByName: filteredSuppliersByName,
            suppliersByProduct: filteredSuppliersByProduct,
          })

          // Track search interaction (both interaction tracking and search intent)
          const { trackSearch } = await import("@/lib/interaction-tracker")
          const { recordSearch } = await import("@/lib/search-intent-tracker")
          const totalResults = filteredProducts.length + filteredSuppliersByName.length + filteredSuppliersByProduct.length

          // Track in interaction system
          trackSearch(debouncedQ, totalResults)

          // Track in search intent system (for personalization and notifications)
          recordSearch(debouncedQ, totalResults, "global").catch(err =>
            console.warn("[SearchIntent] Failed to record search:", err)
          )
        }
      } catch (error) {
        console.error("Search error:", error)
        if (!cancelled) {
          setSearchResult({
            suppliersByName: [],
            suppliersByProduct: [],
            products: [],
            query: debouncedQ,
            error: "Search failed",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, selectedShop?.supplier_account, locationParam])

  // Seller catalogue (RIGHT)
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!selectedShop) {
        setShopProducts([])
        return
      }
      setLoadingProducts(true)
      try {
        const url = `/api/fetchSuggestions?supplierProducts=${encodeURIComponent(
          selectedShop.supplier_account,
        )}&limit=100&Currency=RWF`
        const res = await fetch(url, { cache: "no-store" })
        const raw = res.ok ? await res.json() : null
        const data = normalizeSupplierProductsResponse(
          raw,
          selectedShop.supplier_account,
          selectedShop.supplier_name,
        )
        if (!cancelled) setShopProducts(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setShopProducts([])
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedShop])

  // Filter shop products - simple text search (no strict filtering)
  const filteredShopProducts = useMemo(() => {
    if (!debouncedSupplierSearch) return shopProducts

    const searchLower = debouncedSupplierSearch.toLowerCase()
    return shopProducts.filter(product => {
      const productText = `${product.item_commercial_name} ${product.item_key_words || ''}`.toLowerCase()
      return productText.includes(searchLower)
    })
  }, [shopProducts, debouncedSupplierSearch])

  // Merge suppliers from both buckets (no dupes)
  const allSuppliers = useMemo(() => {
    if (!searchResult) return []
    const supplierMap = new Map<string, Shop>()
    searchResult.suppliersByName.forEach((s) => supplierMap.set(s.supplier_account, s))
    searchResult.suppliersByProduct.forEach((s) => supplierMap.set(s.supplier_account, s))
    return Array.from(supplierMap.values())
  }, [searchResult])

  // Upgrade selected shop info if a richer copy arrives
  useEffect(() => {
    if (!selectedShop || allSuppliers.length === 0) return
    const full = allSuppliers.find((s) => s.supplier_account === selectedShop.supplier_account)
    if (!full) return
    const needsUpgrade =
      (selectedShop.product_count ?? -1) !== (full.product_count ?? -1) ||
      (selectedShop.supplier_location ?? "") !== (full.supplier_location ?? "")
    if (needsUpgrade) setSelectedShop(full)
  }, [allSuppliers, selectedShop])

  const handleSelectShop = (shop: Shop) => {
    // Clear global search when selecting a new seller
    setQ("")
    setDebouncedQ("")
    setSupplierSearch("")
    setSelectedShop(shop)
    const params = new URLSearchParams({
      supplier: shop.supplier_account,
      supplierName: shop.supplier_name,
    })
    if (locationParam) params.set("location", locationParam)
    if (sectorParam) params.set("sector", sectorParam)
    router.push(`/search?${params.toString()}`)
  }

  const handleClearShop = () => {
    setSelectedShop(null)
    setSupplierSearch("")
    const params = new URLSearchParams()
    if (locationParam) params.set("location", locationParam)
    if (sectorParam) params.set("sector", sectorParam)
    router.push(`/search?${params.toString()}`)
  }

  // Sector Spotlight: fetch sellers with a few products when sector is set
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!sectorParam) {
        setSectorSellers([])
        return
      }
      setLoadingSector(true)
      try {
        const url = `/api/fetchSuggestions?listSuppliersWithProducts=${encodeURIComponent(
          sectorParam,
        )}&Currency=RWF`
        const res = await fetch(url, { cache: "no-store" })
        const arr: any[] = res.ok ? await res.json() : []
        const sellers: SectorSeller[] = (Array.isArray(arr) ? arr : []).map((x) => ({
          seller_account: x.seller_account || x.ACC,
          seller_name: x.seller_name || x.OWNER,
          seller_location: x.seller_location || x.LOCATION,
          seller_momo: x.seller_momo || x.MOMO,
          products: Array.isArray(x.products) ? x.products : [],
        }))
        if (!cancelled) setSectorSellers(sellers)
      } catch (e) {
        if (!cancelled) setSectorSellers([])
      } finally {
        if (!cancelled) setLoadingSector(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [sectorParam])

  // Location
  const applyLocation = () => pushWith({ location: locationDraft })
  const clearLocation = () => {
    setLocationDraft("")
    pushWith({ location: "" })
  }

  // Sector
  const applySector = (val?: string) => pushWith({ sector: val ?? sectorDraft })
  const clearSector = () => {
    setSectorDraft("")
    pushWith({ sector: "" })
  }

  // Get translations for current query
  const translations = debouncedQ ? getTranslations(debouncedQ) : null

  // Calculate total items in table cart
  const tableCartItemCount = tableCartItems.reduce((total, item) => total + item.qty, 0)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Global Search</h1>
          <LocationBadge />
        </div>

        {/* Table Context Indicator */}
        {tableCommand && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-purple-600" />
                <div>
                  <span className="font-medium text-purple-800">
                    Table Order: {tableCommand.tableName}
                  </span>
                  <span className="text-sm text-purple-600 ml-2">
                    • Shopping at {tableCommand.locationName}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
              >
                View My Cart ({tableCartItemCount} items)
              </Button>
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Your items will be grouped with others at this table. Only you can see your own items.
            </p>
          </div>
        )}

        {/* Search Row */}
        <div className="flex gap-2 items-center mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search in English or Kinyarwanda (e.g., water, amazi, honey, ubuki...)"
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loading && <span className="text-sm opacity-60 animate-pulse">Searching...</span>}
        </div>

        {/* Translation Hint */}
        {/* Translation hint removed (AI icon row) */}

        {/* Compact Filter Bar */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border p-3 bg-white">
          <div className="flex flex-wrap items-center gap-2">
            {/* Location input (compact) */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border">
              <span className="text-sm">📍</span>
              <input
                className="bg-transparent outline-none text-sm w-44"
                placeholder="Location (e.g., Kigali)"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyLocation()}
              />
              {locationParam && (
                <button
                  className="text-xs text-gray-500 hover:text-gray-800"
                  onClick={clearLocation}
                  title="Clear location"
                >
                  ✕
                </button>
              )}
              <Button size="sm" variant="secondary" className="h-7" onClick={applyLocation}>
                Apply
              </Button>
            </div>

            {/* Sector picker (compact) */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border">
              <span className="text-sm">🗂️</span>
              <select
                aria-label="Select sector"
                className="bg-transparent outline-none text-sm w-48"
                value={sectorDraft}
                onChange={(e) => {
                  const val = e.target.value
                  setSectorDraft(val)
                  applySector(val)
                }}
              >
                <option value="">Select sector…</option>
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("-", " ")}
                  </option>
                ))}
              </select>
              {sectorParam && (
                <button
                  className="text-xs text-gray-500 hover:text-gray-800"
                  onClick={clearSector}
                  title="Clear sector"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick location chips */}
            <div className="flex items-center gap-1 flex-wrap">
              {QUICK_LOCATIONS.map((city) => (
                <button
                  key={city}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    locationParam === city ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setLocationDraft(city)
                    pushWith({ location: city })
                  }}
                  title={`Filter by ${city}`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Active context / filters (badges) */}
          <div className="flex flex-wrap items-center gap-2">
            {locationParam && (
              <Badge variant="secondary" title="Filtering by location">
                📍 Location: {locationParam}
              </Badge>
            )}
            {sectorParam && (
              <Badge variant="secondary" title="Sector context">
                🗂️ Sector: {sectorParam}
              </Badge>
            )}
            {selectedShop && (
              <Badge
                variant="outline"
                className="gap-2 cursor-pointer"
                onClick={handleClearShop}
                title="Clear supplier filter"
              >
                🔒 Supplier: {selectedShop.supplier_name} <span className="opacity-60">✕</span>
              </Badge>
            )}
          </div>
        </div>

        {searchResult?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {searchResult.error}
          </div>
        )}

        {/* Location-Aware Search Indicator */}
        {(() => {
          const locationData = useLocationStoreEnhanced.getState().location
          if (locationData?.district) {
            return (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Showing results near <strong>{locationData.district}</strong>
                  {locationData.cell && `, ${locationData.cell}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs"
                  onClick={() => {
                    const { useLocationStoreEnhanced } = require("@/lib/location-store-enhanced")
                    useLocationStoreEnhanced.getState().clearLocation()
                    window.location.reload()
                  }}
                >
                  Change location
                </Button>
              </div>
            )
          }
          return null
        })()}

        <div className="max-w-5xl mx-auto">
          {/* Main content (single column; no right sidebar) */}
          <div className="space-y-6">
            {/* Sector Spotlight */}
            {sectorParam && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg">
                    Sector spotlight — <span className="text-blue-700">{sectorParam}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {loadingSector && <span className="text-sm opacity-60 animate-pulse">Loading…</span>}
                    <Button size="sm" variant="outline" onClick={clearSector} title="Clear sector filter">
                      Clear
                    </Button>
                  </div>
                </div>

                {sectorSellers.length === 0 && !loadingSector && (
                  <div className="text-sm text-gray-500">No featured sellers found for this sector.</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sectorSellers.map((s) => (
                    <div key={s.seller_account} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{s.seller_name}</div>
                          <div className="text-xs text-gray-600">
                            {s.seller_location || "Location not specified"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleSelectShop({
                              supplier_account: s.seller_account,
                              supplier_name: s.seller_name,
                              supplier_location: s.seller_location,
                              type: "supplier",
                            })
                          }
                        >
                          View
                        </Button>
                      </div>
                      {Array.isArray(s.products) && s.products.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {s.products.slice(0, 3).map((p) => (
                            <div
                              key={p.item_code + (p.supplier_account || s.seller_account)}
                              className="p-2 rounded border hover:border-blue-300 cursor-pointer"
                              onClick={() =>
                                addProductToCart({
                                  ...p,
                                  supplier_account: p.supplier_account || s.seller_account,
                                  supplier_name: p.supplier_name || s.seller_name,
                                  supplier_location: p.supplier_location || s.seller_location,
                                  momo: p.momo || s.seller_momo || "",
                                })
                              }
                            >
                              <div className="text-sm font-medium">{p.item_commercial_name}</div>
                              <div className="text-xs text-gray-600">{p.item_packet || ""}</div>
                              <div className="text-sm font-semibold text-green-700">
                                {p.item_emballage || ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Supplier products in main area when supplier selected */}
            {selectedShop && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 className="font-semibold text-lg">
                    Products from <span className="text-blue-700">{selectedShop.supplier_name}</span>
                  </h2>
                  <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                    <input
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder={`Search in ${selectedShop.supplier_name}...`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      aria-label="Search products from this supplier"
                    />
                  </div>
                </div>
                {loadingProducts ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Loading products…</div>
                ) : filteredShopProducts.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-500 mb-3">
                      {filteredShopProducts.length} product{filteredShopProducts.length !== 1 ? "s" : ""}
                      {debouncedSupplierSearch ? ` matching "${debouncedSupplierSearch}"` : ""}
                    </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredShopProducts.map((p) => (
                    <div
                      key={p.item_code + (p.supplier_account || "")}
                      role="button"
                      tabIndex={0}
                      onClick={() => addProductToCart(p)}
                      onKeyDown={(e) => onTileKey(e, p)}
                      title="Click to add to cart"
                    >
                      <ProductCard product={toCardProduct(p)} />
                    </div>
                  ))}
                </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    {debouncedSupplierSearch
                      ? `No products matching "${debouncedSupplierSearch}"`
                      : "No products available from this supplier"}
                  </div>
                )}
              </section>
            )}

            {/* Products */}
            {searchResult && searchResult.products.length > 0 && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg">
                    Products matching "<span className="text-blue-700">{debouncedQ}</span>"
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedShop && <Badge variant="outline">🔍 Supplier only</Badge>}
                    {locationParam && <Badge variant="secondary">📍 {locationParam}</Badge>}
                    <span className="text-sm font-normal text-gray-500">
                      {searchResult.products.length} found
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResult.products.map((product) => (
                    <div
                      key={product.item_code + (product.supplier_account || "")}
                      className="rounded-lg border p-3 hover:border-blue-300 transition-colors cursor-pointer group"
                      role="button"
                      tabIndex={0}
                      onClick={() => addProductToCart(product)}
                      onKeyDown={(e) => onTileKey(e, product)}
                      title="Click to add to cart"
                    >
                      <div className="font-medium text-gray-900 group-hover:text-blue-700">
                        {product.item_commercial_name}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{product.item_packet || "No description"}</div>
                      <div className="mt-2 text-base font-semibold text-green-600">
                        {product.item_emballage || "Price not available"}
                      </div>
                      {product.supplier_name && (
                        <div className="mt-2 text-xs text-gray-500">
                          Sold by: {product.supplier_name}
                          {product.supplier_location && ` • ${product.supplier_location}`}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to add to cart →
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Suppliers */}
            {allSuppliers.length > 0 && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg">Suppliers</h2>
                  <div className="flex items-center gap-2">
                    {locationParam && <Badge variant="secondary">📍 {locationParam}</Badge>}
                    <span className="text-sm font-normal text-gray-500">{allSuppliers.length} found</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {allSuppliers.map((supplier) => (
                    <div
                      key={supplier.supplier_account}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedShop?.supplier_account === supplier.supplier_account
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                      onClick={() => handleSelectShop(supplier)}
                      title="Click to preview this supplier's products"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{supplier.supplier_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {supplier.supplier_location || "Location not specified"}
                          </div>
                          {supplier.product_count && (
                            <div className="text-xs text-blue-600 mt-1">
                              {supplier.product_count} matching products
                            </div>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Hint when search has results but no supplier selected */}
            {!selectedShop && !!debouncedQ && allSuppliers.length > 0 && (
              <div className="text-sm text-gray-600 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                Select a supplier from the list above to see and search their products here.
              </div>
            )}

            {/* No Results */}
            {searchResult && allSuppliers.length === 0 && searchResult.products.length === 0 && (
              <div className="text-center py-8 text-gray-500">No results found for "{debouncedQ}"</div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}