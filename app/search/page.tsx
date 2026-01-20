// app/search/page.tsx
"use client"

import { useEffect, useMemo, useState, KeyboardEvent } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { filterSuppliersByRelevance, filterProductsByRelevance } from "@/lib/search-utils"
import { getTranslations } from "@/lib/keyword-mapping"
import { Languages, MapPin, Store } from "lucide-react"
import { useTableCommandStore } from "@/lib/table-command-store"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { LocationBadge } from "@/components/location-badge"
import { useGeolocation } from "@/hooks/use-geolocation"
import { searchNearbyProducts, NearbyProduct } from "@/lib/location-search-api"
import { DistanceBadge } from "@/components/distance-badge"

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

  // 🔥 NEW: Geolocation and nearby search
  const { location: userGPS, loading: gpsLoading, denied: gpsDenied } = useGeolocation()
  const [nearbyResults, setNearbyResults] = useState<{ results: NearbyProduct[]; query: string; radius_used_km: number } | null>(null)
  const [loadingNearby, setLoadingNearby] = useState(false)

  // Supplier GPS coordinates map for distance calculation
  const [supplierGPSMap, setSupplierGPSMap] = useState<Map<string, { lat: number; lng: number }>>(new Map())

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

  // Fetch supplier GPS coordinates for distance calculation
  useEffect(() => {
    const fetchSupplierGPS = async () => {
      try {
        const response = await fetch('/api/admin/gps-audit', { cache: 'no-store' })
        if (!response.ok) return

        const data = await response.json()
        const suppliers = data.issues || []

        // Build GPS map for quick lookup
        const gpsMap = new Map<string, { lat: number; lng: number }>()
        suppliers.forEach((s: any) => {
          if (s.ISHYIGA_ACCOUNT && s.supplier_latitude && s.supplier_longitude) {
            gpsMap.set(s.ISHYIGA_ACCOUNT, {
              lat: s.supplier_latitude,
              lng: s.supplier_longitude
            })
          }
        })

        setSupplierGPSMap(gpsMap)
        console.log(`[SearchPage] Loaded GPS data for ${gpsMap.size} suppliers`)
      } catch (error) {
        console.error('[SearchPage] Failed to fetch GPS data:', error)
      }
    }

    fetchSupplierGPS()
  }, [])

  // Helper function to calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Unified global search (LEFT) - Now with enhanced relevance filtering
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
          // Apply enhanced relevance filtering on the client side
          // Using stricter thresholds to avoid unrelated results
          const filteredProducts = filterProductsByRelevance(
            data.products || [],
            debouncedQ,
            25 // Strict threshold - only word boundary matches or better
          )

          // Filter suppliers by relevance while preserving their original match_type
          const filteredSuppliersByName = filterSuppliersByRelevance(
            data.suppliersByName || [],
            debouncedQ,
            15 // Lower threshold - show more supplier results
          )

          const filteredSuppliersByProduct = filterSuppliersByRelevance(
            data.suppliersByProduct || [],
            debouncedQ,
            15 // Lower threshold - show more supplier results
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

  // 🔥 NEW: Nearby product search with geolocation
  useEffect(() => {
    let cancelled = false
    async function run() {
      // Only search nearby if we have a query, GPS location, and no specific supplier selected
      if (!debouncedQ || debouncedQ.length < 2 || !userGPS || selectedShop) {
        setNearbyResults(null)
        return
      }

      setLoadingNearby(true)
      try {
        const data = await searchNearbyProducts(debouncedQ, userGPS.lat, userGPS.lng, 10)
        if (!cancelled) {
          setNearbyResults(data)
        }
      } catch (error) {
        console.error("Nearby search error:", error)
        if (!cancelled) {
          setNearbyResults(null)
        }
      } finally {
        if (!cancelled) setLoadingNearby(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedQ, userGPS, selectedShop])

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
        const data: Product[] = res.ok ? await res.json() : []
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

  // Filter shop products based on supplier search with relevance
  const filteredShopProducts = useMemo(() => {
    if (!debouncedSupplierSearch) return shopProducts

    return filterProductsByRelevance(
      shopProducts,
      debouncedSupplierSearch,
      5 // Lower threshold for within-supplier search
    )
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

  // Enrich products with distance and sort by RELEVANCE first, then proximity
  const productsWithDistance = useMemo(() => {
    if (!searchResult?.products || !userGPS || !supplierGPSMap.size) {
      return searchResult?.products || []
    }

    // Add distance and text relevance to each product
    const searchTerm = debouncedQ.toLowerCase().trim()

    const enriched = searchResult.products.map(p => {
      const supplierId = p.supplier_account
      const productName = (p.item_commercial_name || '').toLowerCase()

      // Calculate text relevance boost
      let textScore = p.relevance_score || p.finalScore || 0
      if (searchTerm && productName.includes(searchTerm)) {
        const exactMatch = productName === searchTerm
        const startsWithMatch = productName.startsWith(searchTerm)
        if (exactMatch) {
          textScore += 1000
        } else if (startsWithMatch) {
          textScore += 500
        } else {
          textScore += 100
        }
      }

      // Calculate distance
      let distance: number | undefined = undefined
      if (supplierId && userGPS && supplierGPSMap.size) {
        const supplierGPS = supplierGPSMap.get(supplierId)
        if (supplierGPS) {
          distance = calculateDistance(
            userGPS.lat,
            userGPS.lng,
            supplierGPS.lat,
            supplierGPS.lng
          )
        }
      }

      return { ...p, calculated_distance_km: distance, text_score: textScore }
    })

    // Sort by RELEVANCE (finalScore) first, then by distance
    return enriched.sort((a, b) => {
      // Primary sort: relevance score (higher is better)
      const scoreA = a.relevance_score || a.finalScore || 0
      const scoreB = b.relevance_score || b.finalScore || 0

      if (scoreB !== scoreA) {
        return scoreB - scoreA // High score first
      }

      // Secondary sort: distance (lower is better) 
      const distA = a.calculated_distance_km ?? Infinity
      const distB = b.calculated_distance_km ?? Infinity
      return distA - distB
    })
  }, [searchResult?.products, userGPS, supplierGPSMap])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Global Search</h1>
          <LocationBadge />
        </div>

        {/* Table Context Indicator - Added here */}
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
              // onClick={() => router.push("/cart")}
              >
                View My Cart ({tableCartItemCount} items)
              </Button>
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Your items will be grouped with others at this table. Only you can see your own items.
            </p>
          </div>
        )}

        {/* 🔥 NEW: GPS Status Indicator */}
        {gpsLoading && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-sm text-blue-700">Getting your location for nearby results...</span>
          </div>
        )}

        {gpsDenied && !gpsLoading && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-700">
              Location access denied. Using Kigali as default.
              <button
                className="ml-2 underline hover:text-amber-900"
                onClick={() => window.location.reload()}
              >
                Enable location
              </button>
            </span>
          </div>
        )}

        {userGPS && !gpsDenied && !gpsLoading && debouncedQ && (
          <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">
              Showing nearby results based on your location
              {loadingNearby && <span className="ml-2 animate-pulse">• Searching...</span>}
            </span>
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
        {translations && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <Languages className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-slate-700">Also searching for: </span>
              <span className="font-semibold text-blue-700">
                {translations.english.slice(0, 3).join(", ")}
                {translations.kinyarwanda.length > 0 && translations.kinyarwanda[0].toLowerCase() !== debouncedQ.toLowerCase() && (
                  <> • {translations.kinyarwanda.slice(0, 2).join(", ")}</>
                )}
              </span>
            </div>
          </div>
        )}

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
                  className={`text-xs px-3 py-1 rounded-full border ${locationParam === city ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-100"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (scrollable) */}
          <div
            className="lg:col-span-2 space-y-6 lg:sticky lg:top-4 lg:pr-2"
            style={{
              maxHeight: "calc(100vh - 7rem)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
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

            {/* 🔥 NEW: Nearby Products Section */}
            {nearbyResults && nearbyResults.results.length > 0 && (
              <section className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border-2 border-green-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-green-600" />
                    <h2 className="font-semibold text-lg">
                      Nearby Results for "<span className="text-green-700">{nearbyResults.query}</span>"
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      📍 Within {nearbyResults.radius_used_km} km
                    </Badge>
                    <span className="text-sm font-normal text-gray-600">
                      {nearbyResults.results.length} found
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nearbyResults.results.map((product) => (
                    <div
                      key={product.item_code}
                      className="rounded-lg border-2 border-green-200 bg-white p-3 hover:border-green-400 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() =>
                        addProductToCart({
                          item_code: product.item_code,
                          item_commercial_name: product.item_name,
                          item_packet: "",
                          item_emballage: product.best_offer.sale_price.toString(),
                          supplier_account: product.best_offer.supplier_id,
                          supplier_name: product.best_offer.nickname,
                          type: "product",
                        })
                      }
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 group-hover:text-green-700 transition-colors">
                            {product.item_name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {product.best_offer.nickname}
                          </div>
                          <div className="text-lg font-bold text-green-700 mt-1">
                            {product.best_offer.sale_price.toLocaleString()} RWF
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <DistanceBadge distanceKm={product.best_offer.distance_km} />
                          {product.best_offer.quantity && (
                            <Badge variant="outline" className="text-xs">
                              {product.best_offer.quantity} in stock
                            </Badge>
                          )}
                        </div>
                      </div>

                      {product.other_sellers && product.other_sellers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-500">
                            +{product.other_sellers.length} other seller{product.other_sellers.length > 1 ? 's' : ''} nearby
                            {product.other_sellers.slice(0, 2).map((seller, idx) => (
                              <span key={idx} className="ml-2">
                                • {seller.nickname} ({seller.distance_km.toFixed(1)} km)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                      {productsWithDistance.length} found
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {productsWithDistance.map((product: any) => (
                    <div
                      key={product.item_code + (product.supplier_account || "")}
                      className="rounded-lg border p-3 hover:border-blue-300 transition-colors cursor-pointer group"
                      role="button"
                      tabIndex={0}
                      onClick={() => addProductToCart(product)}
                      onKeyDown={(e) => onTileKey(e, product)}
                      title="Click to add to cart"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 group-hover:text-blue-700 line-clamp-2">
                            {product.item_commercial_name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 line-clamp-1">{product.item_packet || "No description"}</div>
                          <div className="mt-2 text-base font-semibold text-green-600">
                            {product.item_emballage || "Price not available"}
                          </div>
                        </div>
                        {product.calculated_distance_km !== undefined && product.calculated_distance_km < 100 && (
                          <div className="flex-shrink-0">
                            <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {product.calculated_distance_km < 1
                                ? `${Math.round(product.calculated_distance_km * 1000)} m`
                                : `${product.calculated_distance_km.toFixed(1)} km`}
                            </div>
                          </div>
                        )}
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
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedShop?.supplier_account === supplier.supplier_account
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

            {/* No Results */}
            {searchResult && allSuppliers.length === 0 && searchResult.products.length === 0 && (
              <div className="text-center py-8 text-gray-500">No results found for "{debouncedQ}"</div>
            )}
          </div>

          {/* Right Column - Selected Shop Products */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">
                  {selectedShop ? (
                    <>
                      Products from <span className="text-blue-600">{selectedShop.supplier_name}</span>
                    </>
                  ) : (
                    "Select a supplier to view products"
                  )}
                </h2>
                {loadingProducts && <span className="text-sm opacity-60 animate-pulse">Loading...</span>}
              </div>

              {selectedShop && (
                <>
                  {/* Supplier Product Search */}
                  <div className="mb-4">
                    <input
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder={`Search in ${selectedShop.supplier_name}...`}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {debouncedSupplierSearch && (
                      <div className="mt-1 text-xs text-gray-500">
                        Found {filteredShopProducts.length} product{filteredShopProducts.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  <div
                    className="space-y-3 pr-1"
                    style={{ maxHeight: "70vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
                  >
                    {filteredShopProducts.length > 0 ? (
                      filteredShopProducts.map((product) => (
                        <div
                          key={product.item_code + (product.supplier_account || selectedShop?.supplier_account || "")}
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
                          <div className="text-sm text-gray-600 mt-1">{product.item_packet || ""}</div>
                          <div className="mt-2 text-base font-semibold text-green-600">
                            {product.item_emballage || "Price not available"}
                          </div>
                          {product.momo && <div className="mt-2 text-xs text-gray-500">Seller MoMo: {product.momo}</div>}
                          <div className="mt-3 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to add to cart →
                          </div>
                        </div>
                      ))
                    ) : (
                      !loadingProducts && (
                        <div className="text-center py-4 text-gray-500">
                          {debouncedSupplierSearch
                            ? `No products found matching "${debouncedSupplierSearch}"`
                            : "No products available from this supplier"
                          }
                        </div>
                      )
                    )}
                  </div>
                </>
              )}

              {!selectedShop && !!debouncedQ && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                  💡 Select a supplier from the list to see their available products
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}