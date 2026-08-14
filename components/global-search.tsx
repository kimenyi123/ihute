// components/global-search.tsx
"use client"

import { useEffect, useRef, useState, KeyboardEvent, useMemo } from "react"
import { createPortal } from "react-dom"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, Package, Store, Clock, Trash2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { usePrefsStore } from "@/lib/prefs-store"
import { filterSuppliersByRelevance, filterProductsByRelevance } from "@/lib/search-utils"
import { useAuthStore } from "@/lib/auth-store"
import { getRecentSearches, recordSearch, markSearchClick, clearLocalSearchHistory } from "@/lib/search-intent-tracker"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { useGeolocation } from "@/hooks/use-geolocation"
import { searchNearbyProducts, NearbyProduct } from "@/lib/location-search-api"
import { DistanceBadge } from "@/components/distance-badge"
import { Badge } from "@/components/ui/badge"
import { lineSellingPriceFromProductRow } from "@/lib/package-price"
import { sellerDisplayName, sellerDisplayNameFromProduct } from "@/lib/seller-display-name"

export interface GlobalResult {
  type?: "product" | "supplier"
  item_code?: string
  item_commercial_name?: string
  item_packet?: string
  item_emballage?: string
  selling_price?: number | string
  final_selling_price?: number | string
  cost_price?: number | string
  /** Currency from account_signup for this supplier. */
  currency?: string
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
  distance_km?: number
  calculated_distance_km?: number
}

type GlobalSearchResponse = {
  suppliersByName: GlobalResult[]
  suppliersByProduct: GlobalResult[]
  products: GlobalResult[]
  query: string
  timestamp?: number
  error?: string
  /** Set when Next proxy or backend times out / degrades gracefully */
  warning?: string
  /** When item is not in NIKI (Redis), backend falls back to DB */
  source?: "redis" | "database"
  fromNiki?: boolean
  searchStats?: {
    totalProducts: number
    totalSuppliers: number
    dataSource: string
    cacheHit: boolean
  }
}

function productMatchScore(p: GlobalResult): number {
  return p.relevance_score ?? p.finalScore ?? 0
}

function formatDropdownPrice(p: GlobalResult): string {
  const row = p as Record<string, unknown>
  const fromFinal =
    typeof p.final_selling_price === "number"
      ? p.final_selling_price
      : parseFloat(String(p.final_selling_price ?? "").replace(/[^\d.,-]/g, "").replace(",", "."))
  const line =
    Number.isFinite(fromFinal) && fromFinal > 0
      ? fromFinal
      : lineSellingPriceFromProductRow(row)
  if (!Number.isFinite(line) || line <= 0) return ""
  return `${line.toLocaleString()} ${p.currency || "RWF"}`
}

/** Within each supplier: best relevance first, then nearest distance. */
function sortProductsWithinSupplier(products: GlobalResult[]): GlobalResult[] {
  return [...products].sort((a, b) => {
    const scoreDiff = productMatchScore(b) - productMatchScore(a)
    if (scoreDiff !== 0) return scoreDiff
    const da = a.calculated_distance_km ?? Infinity
    const db = b.calculated_distance_km ?? Infinity
    return da - db
  })
}

/**
 * For specific multi-word queries, collapse the dropdown to one row when there is an
 * obvious best match (exact title, unique phrase match, or large score gap vs #2).
 */
function narrowGlobalDropdownToBestMatch(
  products: Array<GlobalResult & { finalScore?: number }>,
  searchQuery: string
): GlobalResult[] {
  const q = searchQuery.trim().toLowerCase().replace(/\s+/g, " ")
  if (products.length <= 1 || q.length < 3) return products

  const words = q.split(/\s+/).filter((w) => w.length > 0)
  const isMultiWord = words.length >= 2

  const normName = (p: GlobalResult) =>
    (p.item_commercial_name || "").toLowerCase().replace(/\s+/g, " ").trim()

  if (isMultiWord) {
    const exact = products.filter((p) => normName(p) === q)
    if (exact.length === 1) return exact

    const phraseHits = products.filter((p) => {
      const n = normName(p)
      return n.includes(q)
    })
    if (phraseHits.length === 1) return phraseHits
  }

  const sorted = [...products].sort(
    (a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)
  )
  const top = sorted[0]
  const second = sorted[1]
  if (!top || !second) return products

  const topS = top.finalScore ?? 0
  const secondS = second.finalScore ?? 0
  if (topS < 70) return products
  if (secondS >= topS - 5) return products
  if (isMultiWord && topS >= 85 && secondS < topS * 0.55) return [top]
  if (!isMultiWord && topS >= 95 && secondS < topS * 0.45) return [top]

  return products
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

  for (const [key, list] of grouped) {
    grouped.set(key, sortProductsWithinSupplier(list))
  }

  return grouped
}

export function GlobalSearch({
  placeholder = "🔍 Search products, brands, or scan barcode...",
  className,
  maxSuggestions = 15,
}: {
  placeholder?: string
  className?: string
  maxSuggestions?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  /** On `/category_ai/*`, search drives the page grid via `?sq=` — no suggestion dropdown. */
  const isCategoryAi = Boolean(pathname?.startsWith("/category_ai"))
  const sqFromUrl = searchParams.get("sq") ?? ""
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [products, setProducts] = useState<GlobalResult[]>([])
  const [suppliers, setSuppliers] = useState<GlobalResult[]>([])
  const [stats, setStats] = useState<GlobalSearchResponse["searchStats"] | null>(null)
  const [fromNiki, setFromNiki] = useState<boolean | null>(null)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  /** Invalidates in-flight fetch results when the user types again (avoids stuck loading / stale data). */
  const searchRequestIdRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const categoryInputFocusedRef = useRef(false)

  const sector = usePrefsStore((s) => s.sector)
  const categoryBrowseMode = usePrefsStore((s) => s.categoryBrowseMode)
  const location = usePrefsStore((s) => s.location)
  const { user } = useAuthStore()
  const userLocation = useLocationStoreEnhanced((s) => s.location)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [nearbySuppliers, setNearbySuppliers] = useState<GlobalResult[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  // GPS-based nearby product search
  const { location: userGPS, loading: gpsLoading, denied: gpsDenied } = useGeolocation()
  const [nearbyProducts, setNearbyProducts] = useState<{ results: NearbyProduct[]; query: string; radius_used_km: number } | null>(null)
  const [loadingNearbyProducts, setLoadingNearbyProducts] = useState(false)

  // Supplier GPS coordinates map for distance calculation
  const [supplierGPSMap, setSupplierGPSMap] = useState<Map<string, { lat: number; lng: number }>>(new Map())

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

  useEffect(() => {
    setMounted(true)
    // Load recent searches for suggestions
    getRecentSearches(5).then(setRecentSearches).catch(() => { })
  }, [user])

  /** Keep input in sync with `?sq=` (back/forward, deep links). */
  useEffect(() => {
    if (!isCategoryAi) return
    if (categoryInputFocusedRef.current) return
    setQ(sqFromUrl)
  }, [isCategoryAi, sqFromUrl, pathname])

  /** Debounce header text → `?sq=` so category grids can filter without a dropdown. */
  useEffect(() => {
    if (!isCategoryAi) return
    const id = setTimeout(() => {
      const trimmed = q.trim()
      const next = new URLSearchParams(searchParams.toString())
      if (trimmed) next.set("sq", trimmed)
      else next.delete("sq")
      const nextStr = next.toString()
      const cur = searchParams.toString()
      if (nextStr === cur) return
      router.replace(`${pathname}?${nextStr}`, { scroll: false })
    }, 300)
    return () => clearTimeout(id)
  }, [q, isCategoryAi, pathname, router, searchParams])

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
        console.log(`[GlobalSearch] Loaded GPS data for ${gpsMap.size} suppliers`)
      } catch (error) {
        console.error('[GlobalSearch] Failed to fetch GPS data:', error)
      }
    }

    fetchSupplierGPS()
  }, [])

  // Fetch nearby suppliers when user has location
  useEffect(() => {
    const fetchNearbySuppliers = async () => {
      if (!userLocation?.latitude || !userLocation?.longitude) {
        setNearbySuppliers([])
        return
      }
      setLoadingNearby(true)
      try {
        // Fetch all suppliers with GPS from admin endpoint
        const response = await fetch('/api/admin/gps-audit', { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to fetch suppliers')

        const data = await response.json()
        const suppliers = data.issues || []

        // Calculate distances and filter suppliers with coordinates
        const suppliersWithDistance = suppliers
          .filter((s: any) => s.supplier_latitude && s.supplier_longitude)
          .map((s: any) => {
            const distance = calculateDistance(
              userLocation.latitude!,
              userLocation.longitude!,
              s.supplier_latitude,
              s.supplier_longitude
            )
            return {
              type: 'supplier' as const,
              supplier_account: s.ISHYIGA_ACCOUNT,
              supplier_name: s.nickname,
              supplier_location: [s.loc_cell, s.loc_district].filter(Boolean).join(', ') || 'Location not set',
              distance_km: distance,
              product_count: 0,
            }
          })
          .sort((a: GlobalResult, b: GlobalResult) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
          .slice(0, 10) // Top 10 nearest

        setNearbySuppliers(suppliersWithDistance)
      } catch (error) {
        console.error('[NearbySuppliers] Fetch error:', error)
        setNearbySuppliers([])
      } finally {
        setLoadingNearby(false)
      }
    }
    fetchNearbySuppliers()
  }, [userLocation?.latitude, userLocation?.longitude])

  // Fetch nearby products when user has GPS and types a query
  useEffect(() => {
    let cancelled = false

    const fetchNearbyProducts = async () => {
      if (isCategoryAi) {
        setNearbyProducts(null)
        return
      }
      // Only search nearby if we have a query and GPS location
      if (!q.trim() || q.trim().length < 2 || !userGPS) {
        setNearbyProducts(null)
        return
      }

      setLoadingNearbyProducts(true)
      try {
        const data = await searchNearbyProducts(q.trim(), userGPS.lat, userGPS.lng, 5)
        if (!cancelled) {
          setNearbyProducts(data)
        }
      } catch (error) {
        console.error('[NearbyProducts] Fetch error:', error)
        if (!cancelled) {
          setNearbyProducts(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingNearbyProducts(false)
        }
      }
    }

    const timeout = setTimeout(fetchNearbyProducts, 300) // Debounce
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [q, userGPS, isCategoryAi])

  /** Full search page: user adds to cart there, not from the dropdown. */
  const openProductInSearch = (p: GlobalResult) => {
    const term = q.trim() || (p.item_commercial_name || "").toString().trim()
    const supplierAccount = (p.supplier_account || p.item_seller_account || "").toString().trim()
    const supplierName = (p.supplier_name || "").toString().trim()
    const itemCode = (p.item_code || p.item_key_words || "").toString().trim()

    if (term) {
      markSearchClick(term, itemCode || undefined, supplierAccount || undefined).catch((err) =>
        console.warn("[SearchIntent] Failed to mark click:", err)
      )
    }

    const params = new URLSearchParams({
      ...(term ? { q: term } : {}),
      ...(supplierAccount ? { supplier: supplierAccount } : {}),
      ...(supplierName ? { supplierName } : {}),
      ...(itemCode ? { item: itemCode } : {}),
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })
    setOpen(false)
    setQ("")
    router.push(`/search?${params.toString()}`)
  }

  const openNearbyProductInSearch = (product: NearbyProduct) => {
    const term = q.trim() || product.item_name
    const supplierAccount = product.best_offer.supplier_id
    const supplierName = product.best_offer.nickname
    if (term) {
      markSearchClick(term, product.item_code, supplierAccount).catch((err) =>
        console.warn("[SearchIntent] Failed to mark click:", err)
      )
    }
    const params = new URLSearchParams({
      q: term,
      supplier: supplierAccount,
      supplierName,
      item: product.item_code,
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })
    setOpen(false)
    setQ("")
    router.push(`/search?${params.toString()}`)
  }

  useEffect(() => {
    if (!q.trim()) {
      setProducts([])
      setSuppliers([])
      setStats(null)
      setFromNiki(null)
      setSearchWarning(null)
      setErr(null)
      setOpen(false)
      return
    }

    if (isCategoryAi) {
      setLoading(false)
      setErr(null)
      return
    }

    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const id = setTimeout(() => {
      const requestId = ++searchRequestIdRef.current
      const abortController = new AbortController()
      /** Hard cap so the dropdown never spins until the browser default if the proxy hangs. */
      /** Must allow Redis scan + DB fallback on slow local Kaos; stay under typical browser limits. */
      const CLIENT_SEARCH_TIMEOUT_MS = 40000
      const clientTimeout = setTimeout(() => abortController.abort(), CLIENT_SEARCH_TIMEOUT_MS)

      debounceTimer = setTimeout(async () => {
      setLoading(true)
      setErr(null)
      setSearchWarning(null)

      const trimmedQuery = q.trim()
      console.log(`[GlobalSearch] Searching for: "${trimmedQuery}"`)

      try {
        const trimmedSector = (sector ?? "").trim()
        if (trimmedSector) {
          const mode = categoryBrowseMode === "item" ? "items" : "shops"
          const params = new URLSearchParams({
            sector: trimmedSector,
            mode,
            q: q.trim(),
            Currency: "RWF",
          })
          const res = await fetch(`/api/sector-scoped-search?${params}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          })
          if (!res.ok) {
            throw new Error(`Search failed: ${res.status}`)
          }
          const json = (await res.json()) as {
            results?: GlobalResult[]
            cacheHit?: boolean
            tomcatRtMs?: number
            rtMs?: number
            proxyRtMs?: number
            nextRtMs?: number
          }
          const rawResults = Array.isArray(json.results) ? json.results : []
          console.log("[GlobalSearch] sectorScoped:", {
            sector: trimmedSector,
            mode,
            tomcatRtMs: json.tomcatRtMs ?? json.rtMs,
            proxyRtMs: json.proxyRtMs ?? json.nextRtMs,
            cacheHit: json.cacheHit,
            count: rawResults.length,
          })
          if (mode === "items") {
            setProducts(rawResults.slice(0, maxSuggestions))
            setSuppliers([])
          } else {
            const s = rawResults
              .filter((x) => x.supplier_name || x.supplier_account)
              .slice(0, maxSuggestions)
            setSuppliers(s)
            setProducts([])
          }
          setStats({
            totalProducts: mode === "items" ? rawResults.length : 0,
            totalSuppliers: mode === "shops" ? rawResults.length : 0,
            dataSource: "sectorScopedSearch",
            cacheHit: Boolean(json.cacheHit),
          })
          setFromNiki(null)
          setOpen(true)
          if (q.trim().length >= 2) {
            recordSearch(q.trim(), rawResults.length, "sectorScoped").catch((err) =>
              console.warn("[SearchIntent] Failed to record search:", err)
            )
          }
          return
        }

        const locationData = useLocationStoreEnhanced.getState().location
        const params = new URLSearchParams({
          globalSearch: trimmedQuery,
          limit: String(maxSuggestions),
          Currency: "RWF",
          ...(sector ? { sector } : {}),
          ...(location ? { location } : {}),
          ...(locationData?.district ? { district: locationData.district } : {}),
          ...(locationData?.cell ? { cell: locationData.cell } : {}),
        }).toString()

        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        })

        if (requestId !== searchRequestIdRef.current) return

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`)
        }

        const json: GlobalSearchResponse = await res.json()

        if (requestId !== searchRequestIdRef.current) return

        if (json.warning) {
          setSearchWarning(json.warning)
        }

        console.log("[GlobalSearch] Raw response:", {
          products: json.products?.length || 0,
          suppliersByName: json.suppliersByName?.length || 0,
          suppliersByProduct: json.suppliersByProduct?.length || 0,
          stats: json.searchStats,
          warning: json.warning,
        })

        // Validate response structure
        if (!json.products && !json.suppliersByName && !json.suppliersByProduct) {
          console.warn("[GlobalSearch] Empty response structure:", json)
          setProducts([])
          setSuppliers([])
          setStats(null)
          setFromNiki(null)
          setOpen(true)
          return
        }

        const allProducts = json.products || []
        // Use lower threshold for dropdown (showing fewer results, can afford to be more inclusive)
        const filteredProducts = narrowGlobalDropdownToBestMatch(
          filterProductsByRelevance(allProducts, trimmedQuery, 5),
          trimmedQuery
        )

        const allSuppliers = [...(json.suppliersByName || []), ...(json.suppliersByProduct || [])]
        const validSuppliers = allSuppliers.filter((s) => s.supplier_name) as Array<
          GlobalResult & { supplier_name: string }
        >

        // More lenient thresholds for dropdown
        const supplierThreshold = filteredProducts.length > 0 ? 3 : 10
        const filteredSuppliers = filterSuppliersByRelevance(validSuppliers, trimmedQuery, supplierThreshold)

        const dedupedSuppliers: typeof filteredSuppliers = []
        const seenSupplierKeys = new Set<string>()
        for (const sup of filteredSuppliers) {
          const key = `${sup.supplier_account || sup.item_seller_account || ""}|${sup.supplier_name || ""}`.trim()
          if (!key) continue
          if (seenSupplierKeys.has(key)) continue
          seenSupplierKeys.add(key)
          dedupedSuppliers.push(sup)
        }

        const p = filteredProducts.slice(0, maxSuggestions)
        const s = dedupedSuppliers.slice(0, Math.max(4, Math.floor(maxSuggestions * 0.3)))

        console.log("[GlobalSearch] Filtered results:", {
          rawProducts: allProducts.length,
          filteredProducts: filteredProducts.length,
          shownProducts: p.length,
          rawSuppliers: validSuppliers.length,
          filteredSuppliers: filteredSuppliers.length,
          shownSuppliers: s.length,
          topProductScores: p.slice(0, 3).map((x) => x.finalScore),
        })

        setProducts(p)
        setSuppliers(s)
        setStats(json.searchStats || null)
        setFromNiki(
          json.fromNiki ?? (json.source === "database" ? false : json.source === "redis" ? true : null)
        )
        setOpen(true)

        if (trimmedQuery.length >= 2) {
          const totalResults = p.length + s.length
          recordSearch(trimmedQuery, totalResults, "global").catch((err) =>
            console.warn("[SearchIntent] Failed to record search:", err)
          )
        }
      } catch (e: unknown) {
        const aborted = e instanceof Error && e.name === "AbortError"
        if (requestId !== searchRequestIdRef.current) return

        if (aborted) {
          setProducts([])
          setSuppliers([])
          setStats(null)
          setFromNiki(null)
          setErr(
            "Search timed out — the catalog may be busy. Press Enter to open full search, or try fewer words."
          )
          setOpen(true)
        } else {
          console.error("[GlobalSearch] Error:", e)
          setErr(e instanceof Error ? e.message : "Search failed")
          setProducts([])
          setSuppliers([])
          setStats(null)
          setFromNiki(null)
          setOpen(true)
        }
      } finally {
        clearTimeout(clientTimeout)
        if (requestId === searchRequestIdRef.current) {
          setLoading(false)
        }
      }
      }, 300)
    }, 0)

    return () => {
      clearTimeout(id)
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    }
  }, [q, maxSuggestions, sector, categoryBrowseMode, location, isCategoryAi])

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
    const supplierName = sellerDisplayName({
      supplierName: s.supplier_name,
      supplierAccount: supplierAccount,
      fallback: "",
    })
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
      if (isCategoryAi) {
        document.getElementById("category-ai-grid-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
        return
      }
      onSubmit(q)
    } else if (e.key === "Escape") {
      setOpen(false)
      if (isCategoryAi) {
        setQ("")
        const next = new URLSearchParams(searchParams.toString())
        next.delete("sq")
        router.replace(`${pathname}?${next.toString()}`, { scroll: false })
      }
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

  // Enrich products with distance and sort by proximity when GPS available
  const productsWithDistance = useMemo(() => {
    if (!userGPS || !supplierGPSMap.size || !products.length) {
      return products
    }

    // Add distance to each product
    const enriched = products.map(p => {
      const supplierId = p.supplier_account || p.item_seller_account
      if (!supplierId) return { ...p, calculated_distance_km: undefined }

      const supplierGPS = supplierGPSMap.get(supplierId)
      if (!supplierGPS) return { ...p, calculated_distance_km: undefined }

      const distance = calculateDistance(
        userGPS.lat,
        userGPS.lng,
        supplierGPS.lat,
        supplierGPS.lng
      )

      return { ...p, calculated_distance_km: distance }
    })

    // Sort by RELEVANCE (finalScore) first, then by distance
    return enriched.sort((a: GlobalResult, b: GlobalResult) => {
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
  }, [products, userGPS, supplierGPSMap])

  // Group products by supplier
  const productsBySupplier = groupProductsBySupplier(productsWithDistance)
  const supplierCount = productsBySupplier.size

  const TRENDING_SUGGESTIONS = ["cheap beer", "pharmacy near me", "Leffe", "wine"]

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
          onFocus={() => {
            categoryInputFocusedRef.current = true
            if (!isCategoryAi) setOpen(true)
          }}
          onBlur={() => {
            categoryInputFocusedRef.current = false
          }}
          onKeyDown={onKeyDown}
          className="pl-10 pr-3 h-9 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
        />
      </div>

      {mounted && open && !isCategoryAi && createPortal(
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

          {/* Try / trending suggestions when query empty */}
          {!loading && !err && q.trim().length === 0 && (
            <div className="p-3 border-b">
              <p className="text-[10px] text-muted-foreground mb-1.5">Try:</p>
              <div className="flex flex-wrap gap-1">
                {TRENDING_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-primary/10 text-foreground transition-colors"
                    onClick={() => {
                      setQ(s)
                      onSubmit(s)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
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

          {/* Nearby Suppliers - Show when search is empty and user has location */}
          {!loading && !err && q.trim().length === 0 && nearbySuppliers.length > 0 && (
            <div className="p-3 space-y-2">
              <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Store className="h-3 w-3" />
                📍 Nearest Suppliers ({nearbySuppliers.length})
              </div>
              {loadingNearby ? (
                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Finding nearby suppliers…
                </div>
              ) : (
                <div className="space-y-1">
                  {nearbySuppliers.map((s, i) => (
                    <button
                      key={`nearby-${s.supplier_account}-${i}`}
                      className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:border-green-300 hover:bg-green-50 transition-colors group"
                      onClick={() => onSubmitSupplier(s)}
                    >
                      <Store className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <div className="font-medium leading-tight group-hover:text-green-700">
                          {s.supplier_name || s.supplier_account}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {s.supplier_location}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        {s.distance_km?.toFixed(1)} km
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GPS Status Indicators - Show when user has query */}
          {q.trim().length > 0 && (
            <>
              {gpsLoading && (
                <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-blue-600 animate-pulse" />
                  <span className="text-xs text-blue-700">Getting your location for nearby results...</span>
                </div>
              )}

              {gpsDenied && !gpsLoading && (
                <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-amber-600" />
                  <span className="text-xs text-amber-700">Location access denied. Using Kigali as default.</span>
                </div>
              )}

              {userGPS && !gpsDenied && !gpsLoading && (
                <div className="px-3 py-2 bg-green-50 border-t border-green-200 flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-700">
                    {/* Showing nearby results based on your location */}
                    {loadingNearbyProducts && <span className="ml-2 animate-pulse">• Searching...</span>}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Nearby Products - Show when user has query and GPS */}
          {!loading && !err && nearbyProducts && nearbyProducts.results.length > 0 && (
            <div className="p-3 space-y-2 bg-gradient-to-br from-green-50 to-blue-50 border-t-2 border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-green-800">
                    Nearby Results for "<span className="text-green-700">{nearbyProducts.query}</span>"
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    📍 Within {nearbyProducts.radius_used_km} km
                  </Badge>
                  <span className="text-xs text-gray-600">{nearbyProducts.results.length} found</span>
                </div>
              </div>

              <div className="space-y-2">
                {nearbyProducts.results.map((product) => (
                  <button
                    key={product.item_code}
                    className="w-full rounded-lg border-2 border-green-200 bg-white p-3 hover:border-green-400 hover:shadow-md transition-all cursor-pointer group text-left"
                    onClick={() => openNearbyProductInSearch(product)}
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
                    <div className="mt-2 text-[11px] text-green-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      View product on search →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && !err && (products.length > 0 || suppliers.length > 0) && (
            <div className="p-3 space-y-3">
              {fromNiki === false && (
                <div className="px-2 py-1 text-[10px] text-amber-700 bg-amber-50 rounded border border-amber-200">
                  Results from full catalog (not in NIKI cache).
                </div>
              )}
              {/* Search Stats */}
              {(stats || products.length > 0) && (
                <div className="px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {products.length} product{products.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {supplierCount} supplier{supplierCount !== 1 ? "s" : ""}
                  </span>
                  {stats?.cacheHit && (
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
                            {sellerDisplayNameFromProduct({
                              ...firstProduct,
                              supplier_account: supplierId,
                            })}
                            {firstProduct.supplier_location && (
                              <span className="text-gray-500">• {firstProduct.supplier_location}</span>
                            )}
                            <span className="ml-auto text-blue-600">
                              {supplierProducts.length} product{supplierProducts.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Products from this supplier */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {supplierProducts.map((p, i) => {
                              const priceLabel = formatDropdownPrice(p)
                              return (
                              <button
                                key={`${supplierId}-${p.item_code}-${i}`}
                                className="w-full text-left rounded-lg border p-3 hover:border-blue-300 hover:bg-accent transition-colors group"
                                onClick={() => openProductInSearch(p)}
                                title="Open full search to view and add to cart"
                              >
                                <div className="font-medium text-gray-900 group-hover:text-blue-700 text-sm">
                                  {p.item_commercial_name}
                                </div>
                                {p.item_packet ? (
                                  <div className="text-xs text-gray-600 mt-0.5">
                                    {p.item_packet} in stock
                                  </div>
                                ) : null}
                                {priceLabel ? (
                                  <div className="mt-1 text-sm font-semibold text-green-600">
                                    {priceLabel}
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  View product →
                                </div>
                              </button>
                            )})}
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
