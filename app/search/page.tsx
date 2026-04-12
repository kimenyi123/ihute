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
import { ProductQuickView, type QuickViewProduct } from "@/components/product-quick-view"
import { fetchSearchSuggestions } from "@/lib/search-suggestions"
import { usePriceDropToasts } from "@/lib/use-price-drop-toasts"
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import { dedupeSearchProductsByItemCodeAndSellingPrice } from "@/lib/dedupe-search-products"
import { parseItemStateBatchExpiry } from "@/lib/item-state-display"
import {
  getProductImageCandidates,
  getProductImageUrl,
  getProductImageSrc,
  isValidImageUrl,
  NO_IMAGE_URL,
  normalizeImageUrl,
} from "@/lib/image-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import Image from "next/image"
import { cn } from "@/lib/utils"

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
  /** Batch / expiry line from Redis (e.g. Ex:ddmmyy) — needed for per-lot cards. */
  item_state?: string
  /** When set by `/api/fetchSuggestions` enrichment, prefer this for display & sort. */
  final_selling_price?: number
  selling_price?: number | string
  cost_price?: number | string
  /** Currency from account_signup for this supplier. */
  currency?: string
  item_key_words?: string
  item_key_words_french?: string
  item_key_words_kinyarwanda?: string
  item_description?: string
  supplier_account?: string
  supplier_name?: string
  supplier_location?: string
  momo?: string
  type: string
  image?: string
  image_url?: string
  item_image_url?: string
  IMAGE_URL?: string
  famille?: string
  FAMILLE?: string
  relevance_score?: number
}

type SearchResult = {
  suppliersByName: Shop[]
  suppliersByProduct: Shop[]
  products: Product[]
  query: string
  timestamp?: number
  error?: string
  /** When item is not in NIKI (Redis), backend falls back to DB and may set this */
  source?: "redis" | "database"
  fromNiki?: boolean
}

type SectorSeller = {
  seller_account: string
  seller_name: string
  seller_location?: string
  seller_momo?: string
  products: Product[]
}

// Category image mapping
const CATEGORY_IMAGES: Record<string, string> = {
  pharmacy: "/pharmacy-medicine-pills-bottles.jpg",
  "liquor-store": "/wine-bottles-liquor-store.jpg", 
  boutique: "/fashion-clothing-boutique-store.jpg",
  "bar-resto": "/restaurant-food-dining-bar.jpg",
  supermarket: "/supermarket-groceries-shopping-cart.jpg",
  "coffee-shop": "/coffee-shop-cafe-espresso.jpg",
  beauty: "/beauty-cosmetics-makeup-products.jpg",
  general: "/general-store-retail-products.jpg",
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || ""
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

/** Compact page numbers with ellipses for supplier product pagination. */
function supplierPaginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 0) return []
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cur = Math.min(Math.max(1, current), total)
  const set = new Set<number>()
  set.add(1)
  set.add(total)
  for (let d = -1; d <= 1; d++) {
    const p = cur + d
    if (p >= 1 && p <= total) set.add(p)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | "ellipsis")[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("ellipsis")
    out.push(sorted[i]!)
  }
  return out
}

/** Derive data source from API response for console logging. */
function getDataSourceLabel(data: {
  source?: string
  fromNiki?: boolean
  products?: Array<{ source?: string }>
}): string {
  if (data.source === "redis" || data.fromNiki === true) return "redis"
  if (data.source === "database" || data.fromNiki === false) return "database"
  const products = data.products ?? []
  if (products.length === 0) return "unknown"
  const redisCount = products.filter((p) => String(p?.source ?? "").toLowerCase().includes("redis")).length
  const dbCount = products.filter((p) =>
    String(p?.source ?? "").toLowerCase().match(/database|stock|niki/)
  ).length
  if (redisCount > 0 && dbCount > 0) return "mixed"
  if (redisCount > 0) return "redis"
  if (dbCount > 0) return "database"
  return "unknown"
}

/** Infer sector from query so food/drink searches don't return pharmacy. Backend uses sector to filter. */
function inferSectorFromQuery(q: string): string {
  if (!q || q.length < 2) return ""
  const lower = q.toLowerCase()
  const foodDrink =
    /\b(martini|chicken|chips|wine|beer|salad|coffee|tea|bread|rice|fish|meat|pork|beef|pizza|pasta|burger|breakfast|lunch|dinner|glass|bottle|drink|food|menu|restaurant|bar|cafe)\b/i.test(lower) ||
    /\b(ingurube|inkoko|umuceri|inzoga|amata|saladi|ibitoki|ifunguro)\b/i.test(lower)
  if (foodDrink) return "bar-resto"
  return ""
}

function normalizeItemCodeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^[([{.,;:\s_-]+/g, "")
    .replace(/[)\].,;:\s_-]+$/g, "")
    .trim()
}

/** All normalized codes we might compare to `item` URL param (handles Redis/DB field names). */
function collectNormalizedProductCodes(p: Product): string[] {
  const q = p as Record<string, unknown>
  const raw = [
    p.item_code,
    p.item_key_words,
    q.ITEM_CODE,
    q.ITEM_KEY_WORDS,
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (typeof x !== "string" || !x.trim()) continue
    const n = normalizeItemCodeForMatch(x)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/**
 * Match `item` query param to a product. For SKU-like params (no spaces), require exact code match
 * so we don't pull in unrelated rows when deep-linking from global search.
 */
function productMatchesItemParam(p: Product, normalizedItem: string): boolean {
  if (!normalizedItem) return false
  const codes = collectNormalizedProductCodes(p)
  const skuLike = !/\s/.test(normalizedItem) && normalizedItem.length >= 2
  return codes.some((c) => {
    if (c === normalizedItem) return true
    if (skuLike) return false
    if (!c.length || !normalizedItem.length) return false
    return c.includes(normalizedItem) || normalizedItem.includes(c)
  })
}

// -------- helpers --------
function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

function coerceOptionalPositiveNumber(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined
  const n =
    typeof raw === "number"
      ? raw
      : parseFloat(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function productItemEmballageRaw(p: Product): unknown {
  return p.item_emballage ?? (p as { ITEM_EMBALLAGE?: unknown }).ITEM_EMBALLAGE
}

function productBaseSellingPrice(p: Product): number {
  return (
    extractNumericPrice(p.selling_price) ||
    extractNumericPrice((p as any).SALE_PRICE_INCLUSIVE) ||
    extractNumericPrice((p as any).price) ||
    0
  )
}

function productGeneralSellingPrice(p: Product): number {
  return generalSellingPrice(productBaseSellingPrice(p), productItemEmballageRaw(p))
}

/** Card / sort / cart line price: API final when present, else selling_price × item_emballage. */
function productLinePrice(p: Product): number {
  const fp = (p as { final_selling_price?: unknown }).final_selling_price
  if (fp != null && fp !== "") {
    const n =
      typeof fp === "number"
        ? fp
        : parseFloat(String(fp).replace(/[^\d.,-]/g, "").replace(",", "."))
    if (Number.isFinite(n) && n >= 0) return n
  }
  return productGeneralSellingPrice(p)
}

function toCardProduct(p: Product & { search_priority?: string; contains_ingredient?: string }) {
  // Image: ProductCard will call getProductImageSrc(product); pass raw fields so it can build KAOS URLs and fallback to backend image_url
  const price =
    extractNumericPrice(p.selling_price) ||
    extractNumericPrice((p as any).SALE_PRICE_INCLUSIVE) ||
    extractNumericPrice((p as any).price) ||
    0
  const baseCode =
    p.item_code ||
    p.item_key_words ||
    `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`
  const linePrice = productLinePrice(p)
  /** Same code at different prices / lots — distinct cart lines. */
  const id = `${baseCode}__p${Math.round(linePrice * 100)}`
  const itemStateRaw = String((p as { item_state?: string }).item_state ?? "").trim()
  const { expiryLabel } = parseItemStateBatchExpiry(itemStateRaw || undefined)
  const apiFinal = (p as { final_selling_price?: unknown }).final_selling_price
  const finalNum =
    apiFinal != null && apiFinal !== ""
      ? typeof apiFinal === "number"
        ? apiFinal
        : parseFloat(String(apiFinal).replace(/[^\d.,-]/g, "").replace(",", "."))
      : NaN
  const hasApiFinal = Number.isFinite(finalNum) && finalNum >= 0

  return {
    id,
    name: p.item_commercial_name || "Product",
    description: undefined,
    price,
    currency: p.currency || "RWF",
    unit: p.item_packet ?? "",
    inStock: true,
    rating: 4,
    supplierId: p.supplier_account,
    supplierName: p.supplier_name || p.supplier_account || "Supplier",
    supplierLocation: p.supplier_location,
    momo: p.momo,
    itemCode: p.item_code || p.item_key_words,
    item_key_words: p.item_key_words,
    item_code: p.item_code,
    famille: (p as any).famille ?? (p as any).FAMILLE,
    image: p.image,
    image_url: p.image_url,
    item_image_url: p.item_image_url,
    IMAGE_URL: (p as any).IMAGE_URL,
    searchPriority: (p.search_priority === "direct" || p.search_priority === "contains" ? p.search_priority : undefined) as "direct" | "contains" | undefined,
    containsIngredient: typeof p.contains_ingredient === "string" ? p.contains_ingredient : undefined,
    itemEmballage: productItemEmballageRaw(p) as string | number | undefined,
    ...(hasApiFinal ? { final_selling_price: finalNum } : {}),
    ...(itemStateRaw ? { item_state: itemStateRaw } : {}),
    ...(expiryLabel ? { expiryLabel } : {}),
  }
}

function ProductThumb({ product, alt }: { product: Product; alt: string }) {
  const imageCandidates = useMemo(
    () =>
      getProductImageCandidates(product as any),
    [
      product.item_code,
      product.item_key_words,
      (product as any).famille,
      (product as any).FAMILLE,
      product.image,
      product.image_url,
      product.item_image_url,
      (product as any).IMAGE_URL,
    ]
  )
  const signature = imageCandidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)
  const src = imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] ?? NO_IMAGE_URL

  useEffect(() => {
    setCandidateIdx(0)
  }, [signature])

  const show = isValidImageUrl(src) ? src : NO_IMAGE_URL

  return (
    <img
      src={show}
      alt={alt}
      className="h-14 w-14 rounded-md object-cover bg-muted flex-none"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (candidateIdx + 1 < imageCandidates.length) {
          setCandidateIdx((i) => i + 1)
        }
      }}
    />
  )
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

  // Redis format: { key: "supplier_<account>", data: [ ... ] }; item_emballage as-is (empty remains empty); price from selling_price
  if (typeof data === "object" && Array.isArray(data.data)) {
    return normalizeSupplierProductsResponse(data.data, supplierAccount, supplierName)
  }

  if (Array.isArray(data)) {
    const flat: Product[] = []
    for (const p of data) {
      const items = (p as any).items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const itemState = String(item.item_state ?? item.ITEM_STATE ?? "").trim()
          const nestedFinal = coerceOptionalPositiveNumber(item.final_selling_price)
          flat.push({
            item_code: item.item_key_words ?? item.item_code ?? "",
            item_commercial_name: item.item_commercial_name ?? item.item_name ?? "Product",
            item_packet: item.item_packet,
            item_emballage: item.item_emballage ?? item.ITEM_EMBALLAGE ?? "",
            ...(itemState ? { item_state: itemState } : {}),
            ...(nestedFinal != null ? { final_selling_price: nestedFinal } : {}),
            selling_price: item.selling_price ?? item.SALE_PRICE_INCLUSIVE,
            cost_price: item.cost_price,
            currency: item.currency,
            item_key_words: item.item_key_words,
            item_key_words_french: item.item_key_words_french,
            item_key_words_kinyarwanda: item.item_key_words_kinyarwanda,
            item_description: item.item_description ?? item.description,
            supplier_account,
            supplier_name,
            supplier_location: (p as any).supplier_location ?? undefined,
            type: (p as any).type ?? "product",
            // Preserve original backend image fields for KAOS URL construction
            image: item.image,
            image_url: item.image_url,
            item_image_url: item.item_image_url,
            IMAGE_URL: item.IMAGE_URL,
            // Also preserve famille for KAOS paths
            famille: item.famille,
            FAMILLE: item.FAMILLE,
            momo: item.momo ?? (p as any).momo,
          })
        }
      } else {
            const q = p as any
            const rawImg = getProductImageUrl(q)
            const img = rawImg ? (normalizeImageUrl(rawImg) ?? rawImg) : undefined
        const flatState = String(q.item_state ?? q.ITEM_STATE ?? "").trim()
        const flatFinal = coerceOptionalPositiveNumber(q.final_selling_price)
        flat.push({
          item_code: q.item_key_words ?? q.item_code ?? q.ITEM_CODE ?? "",
          item_commercial_name: q.item_commercial_name ?? q.item_name ?? q.ITEM_NAME ?? "Product",
          item_packet: q.item_packet ?? q.UNIT,
          item_emballage: q.item_emballage ?? q.ITEM_EMBALLAGE ?? "",
          ...(flatState ? { item_state: flatState } : {}),
          ...(flatFinal != null ? { final_selling_price: flatFinal } : {}),
          item_key_words: q.item_key_words,
          item_key_words_french: q.item_key_words_french,
          item_key_words_kinyarwanda: q.item_key_words_kinyarwanda,
          item_description: q.item_description ?? q.description,
          supplier_account: q.supplier_account ?? supplier_account,
          supplier_name: q.supplier_name ?? supplier_name,
          supplier_location: q.supplier_location,
          type: q.type ?? "product",
          // Preserve original backend image fields for KAOS URL construction
          image: q.image,
          image_url: q.image_url,
          item_image_url: q.item_image_url,
          IMAGE_URL: q.IMAGE_URL,
          // Also preserve famille for KAOS paths
          famille: q.famille,
          FAMILLE: q.FAMILLE,
          selling_price: q.selling_price ?? q.SALE_PRICE_INCLUSIVE ?? q.price,
          cost_price: q.cost_price,
          currency: q.currency,
          momo: q.momo,
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
  const itemParam = searchParams.get("item")?.trim() ?? ""

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

  // Supplier product search (hits backend when query is non-empty)
  const [supplierSearch, setSupplierSearch] = useState("")
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState("")
  const [supplierSearchResults, setSupplierSearchResults] = useState<Product[] | null>(null)
  const [loadingSupplierSearch, setLoadingSupplierSearch] = useState(false)
  const [productSort, setProductSort] = useState<"relevance" | "price-asc" | "price-desc">("relevance")
  const [supplierProductSort, setSupplierProductSort] = useState<"relevance" | "price-asc" | "price-desc">("relevance")
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [suggestionTerms, setSuggestionTerms] = useState<string[]>([])
  const [supplierProductPage, setSupplierProductPage] = useState(1)
  const [supplierProductsPerPage, setSupplierProductsPerPage] = useState(15)

  function toQuickViewProduct(p: Product): QuickViewProduct {
    const emb = productItemEmballageRaw(p)
    return {
      id: p.item_code || p.item_key_words || "",
      name: p.item_commercial_name || "Product",
      price: productLinePrice(p),
      currency: p.currency || "RWF",
      unit: p.item_packet ?? "",
      image: getProductImageSrc(p),
      itemCode: p.item_code || p.item_key_words,
      supplierId: p.supplier_account,
      supplierName: p.supplier_name,
      itemEmballage: normalizeItemEmballageForCart(emb),
    }
  }

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

    const itemCode = (p.item_code || p.item_key_words || "").toString().trim()
    const id = itemCode || `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`
    const unit = p.item_packet || ""
    const embRaw = productItemEmballageRaw(p)
    const price = productLinePrice(p)
    const itemEmballage = normalizeItemEmballageForCart(embRaw)
    const supplierId = (p.supplier_account || "unknown").toString().trim()
    const supplierName = p.supplier_name || p.supplier_account || "Supplier"
    const baseItem = {
      id,
      itemCode: itemCode || id,
      name: p.item_commercial_name,
      price,
      unit,
      selectedUnit: unit,
      qty: 1,
      supplierId,
      supplierName,
      supplierLocation: p.supplier_location,
      image: getProductImageSrc(p as any, "/placeholder.svg?height=300&width=300"),
      image_url: p.image_url,
      item_image_url: p.item_image_url,
      IMAGE_URL: (p as any).IMAGE_URL,
      item_key_words: p.item_key_words,
      famille: (p as any).famille ?? (p as any).FAMILLE,
      momo: p.momo || (p as any)?.seller_momo || "",
      ...(itemEmballage ? { itemEmballage } : {}),
    }

    // Check if we're in a table command context
    if (tableCommand && tableCommand.locationId === p.supplier_account) {
      if (addToTableCart) {
        addToTableCart({ ...baseItem })
      } else {
        addToCartFn({ ...baseItem })
      }
    } else {
      addToCartFn({ ...baseItem })
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
    const itemFromUrl = searchParams.get("item")?.trim()
    if (itemFromUrl && supplierParam) params.set("item", itemFromUrl)

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

  // Quick search: 200ms debounce so backend is hit fast (like shop-with-me)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  // Load suggestion terms when search is empty (recent + popular from API)
  useEffect(() => {
    if (q.trim() !== "") {
      setSuggestionTerms([])
      return
    }
    let cancelled = false
    fetchSearchSuggestions(12).then((terms) => {
      if (!cancelled) setSuggestionTerms(terms)
    })
    return () => { cancelled = true }
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

  // Supplier search debounce (quick: 200ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSupplierSearch(supplierSearch.trim()), 200)
    return () => clearTimeout(t)
  }, [supplierSearch])

  // ====== MAIN FIX: Trust backend translation results ======
  useEffect(() => {
    const cancelled = false
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
        const sectorToSend = sectorParam || inferSectorFromQuery(debouncedQ)
        if (sectorToSend) {
          url.searchParams.set("sector", sectorToSend)
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
          // Log data source (Redis vs DB) for debugging
          const dataSource = getDataSourceLabel({
            source: data.source,
            fromNiki: data.fromNiki,
            products: data.products?.map((p: any) => ({ source: p.source })) || []
          })
          const productSources = (data.products ?? []).map((p: Product & { source?: string }) => p?.source ?? "?")
          console.log("[Search] Data source:", dataSource, "| Query:", debouncedQ, "| Products:", data.products?.length ?? 0, "| source:", data.source, "fromNiki:", data.fromNiki, "| Product sources:", productSources.slice(0, 5))
          if (dataSource === "unknown") {
            const responseKeys = Object.keys(data as object)
            const firstProduct = (data.products ?? [])[0] as Record<string, unknown> | undefined
            const firstProductKeys = firstProduct ? Object.keys(firstProduct) : []
            console.warn("[Search] DEBUG data source unknown: backend did not set source/fromNiki or product.source. Response keys:", responseKeys, "| First product keys (sample):", firstProductKeys.slice(0, 20))
          }

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
     
  }, [debouncedQ, selectedShop?.supplier_account, locationParam, sectorParam])

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
        )}&limit=10000&Currency=RWF`
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

  // When user types in "Search in PANGOLIN'S BURROWS", hit backend (fetchSuggestions) so keyword search works
  useEffect(() => {
    let cancelled = false
    const query = debouncedSupplierSearch.trim()
    if (!selectedShop || !query) {
      setSupplierSearchResults(null)
      setLoadingSupplierSearch(false)
      return
    }
    const supplierAccount = selectedShop.supplier_account
    const supplierName = selectedShop.supplier_name
    setLoadingSupplierSearch(true)
    async function run() {
      try {
        const url = new URL(`/api/fetchSuggestions`, window.location.origin)
        url.searchParams.set("globalSearch", query)
        url.searchParams.set("supplier", supplierAccount)
        url.searchParams.set("Currency", "RWF")
        const res = await fetch(url.toString(), { cache: "no-store" })
        const data = res.ok ? await res.json() : null
        if (cancelled) return

      
        const dataSource = data ? getDataSourceLabel(data) : "no response"
        const productCount = Array.isArray(data?.products) ? data.products.length : 0
        const productSources = (data?.products ?? []).map((p: { source?: string }) => p?.source ?? "?")
        console.log("[Search] Supplier-scoped | Query:", JSON.stringify(query), "| Supplier:", supplierAccount, "| Data source:", dataSource, "| Products returned:", productCount, "| Product sources:", productSources)
        if (dataSource === "unknown" && data) {
          const responseKeys = Object.keys(data)
          const firstProduct = (data.products ?? [])[0] as Record<string, unknown> | undefined
          console.warn("[Search] DEBUG supplier-scoped source unknown: backend response keys:", responseKeys, "| First product keys:", firstProduct ? Object.keys(firstProduct).slice(0, 15) : "none")
        }

        setSupplierSearchResults(
          Array.isArray(data?.products)
            ? normalizeSupplierProductsResponse(data.products, supplierAccount, supplierName)
            : []
        )
      } catch {
        if (!cancelled) setSupplierSearchResults([])
      } finally {
        if (!cancelled) setLoadingSupplierSearch(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedSupplierSearch, selectedShop])

  // Products to show in "Products from X" panel: filter by price then sort.
  // Fallback: when backend returns 0 for supplier-scoped search, filter loaded catalog client-side (e.g. "inkoko" in item_key_words_kinyarwanda).
  const displayedSupplierProducts = useMemo(() => {
    const query = debouncedSupplierSearch.trim()
    let raw: Product[]
    if (!query) {
      raw = shopProducts
    } else if (Array.isArray(supplierSearchResults) && supplierSearchResults.length > 0) {
      raw = supplierSearchResults
    } else if (shopProducts.length > 0) {
      // Backend returned 0; filter loaded catalog by name/keywords/kinyarwanda/french
      const q = query.toLowerCase()
      raw = shopProducts.filter((p) => {
        const name = (p.item_commercial_name ?? "").toLowerCase()
        const kw = (p.item_key_words ?? "").toLowerCase()
        const kr = ((p as any).item_key_words_kinyarwanda ?? "").toLowerCase()
        const fr = ((p as any).item_key_words_french ?? "").toLowerCase()
        const desc = ((p as any).description ?? "").toLowerCase()
        return [name, kw, kr, fr, desc].some((s) => s.includes(q))
      })
      if (raw.length > 0) {
        console.log("[Search] Supplier-scoped fallback: backend returned 0, client-side match found", raw.length, "products for", JSON.stringify(query))
      }
    } else {
      raw = supplierSearchResults ?? []
    }
    const filtered = raw.filter((p) => {
      const base =
        extractNumericPrice(p.selling_price) ||
        extractNumericPrice((p as any).SALE_PRICE_INCLUSIVE) ||
        extractNumericPrice((p as any).price)
      return base > 0
    })
    // Same as `/api/fetchSuggestions` keyword path: one card per supplier + item code + base selling price (multi-lot → merged).
    const deduped = dedupeSearchProductsByItemCodeAndSellingPrice(filtered) as Product[]
    let ordered: Product[]
    if (supplierProductSort === "price-asc")
      ordered = [...deduped].sort((a, b) => productLinePrice(a) - productLinePrice(b))
    else if (supplierProductSort === "price-desc")
      ordered = [...deduped].sort((a, b) => productLinePrice(b) - productLinePrice(a))
    else ordered = deduped

    if (itemParam) {
      const norm = normalizeItemCodeForMatch(itemParam)
      let matches = ordered.filter((p) => productMatchesItemParam(p, norm))
      if (matches.length === 0 && debouncedQ.trim()) {
        const qn = debouncedQ.trim().toLowerCase().replace(/\s+/g, " ").trim()
        matches = ordered.filter(
          (p) => (p.item_commercial_name || "").toLowerCase().replace(/\s+/g, " ").trim() === qn
        )
      }
      if (matches.length > 0) ordered = matches
    }
    return ordered
  }, [debouncedSupplierSearch, supplierSearchResults, shopProducts, supplierProductSort, itemParam, debouncedQ])

  // Reset supplier products page when list, sort, in-supplier search, or page size changes
  useEffect(() => {
    setSupplierProductPage(1)
  }, [displayedSupplierProducts.length, supplierProductSort, debouncedSupplierSearch, supplierProductsPerPage])

  const supplierTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displayedSupplierProducts.length / supplierProductsPerPage)),
    [displayedSupplierProducts.length, supplierProductsPerPage],
  )

  useEffect(() => {
    setSupplierProductPage((p) => (p > supplierTotalPages ? supplierTotalPages : p))
  }, [supplierTotalPages])

  const paginatedSupplierProducts = useMemo(() => {
    const page = Math.min(supplierProductPage, supplierTotalPages)
    const start = (page - 1) * supplierProductsPerPage
    return displayedSupplierProducts.slice(start, start + supplierProductsPerPage)
  }, [displayedSupplierProducts, supplierProductPage, supplierProductsPerPage, supplierTotalPages])

  const supplierPageSafe = Math.min(supplierProductPage, supplierTotalPages)
  const supplierRangeStart =
    displayedSupplierProducts.length === 0 ? 0 : (supplierPageSafe - 1) * supplierProductsPerPage + 1
  const supplierRangeEnd =
    displayedSupplierProducts.length === 0
      ? 0
      : supplierRangeStart + paginatedSupplierProducts.length - 1

  const supplierPageList = useMemo(
    () => supplierPaginationPages(supplierProductPage, supplierTotalPages),
    [supplierProductPage, supplierTotalPages],
  )

  // Main search products (global): exclude 0 price, then sort
  const searchProductsWithPrice = useMemo(() => {
    const list = searchResult?.products ?? []
    const filtered = list.filter((p) => {
      const base =
        extractNumericPrice(p.selling_price) ||
        extractNumericPrice((p as any).SALE_PRICE_INCLUSIVE) ||
        extractNumericPrice((p as any).price)
      return base > 0
    })
    let ordered: Product[]
    if (productSort === "price-asc")
      ordered = [...filtered].sort((a, b) => productLinePrice(a) - productLinePrice(b))
    else if (productSort === "price-desc")
      ordered = [...filtered].sort((a, b) => productLinePrice(b) - productLinePrice(a))
    else ordered = filtered

    if (itemParam) {
      const norm = normalizeItemCodeForMatch(itemParam)
      let matches = ordered.filter((p) => productMatchesItemParam(p, norm))
      if (matches.length === 0 && debouncedQ.trim()) {
        const qn = debouncedQ.trim().toLowerCase().replace(/\s+/g, " ").trim()
        matches = ordered.filter(
          (p) => (p.item_commercial_name || "").toLowerCase().replace(/\s+/g, " ").trim() === qn
        )
      }
      if (matches.length > 0) ordered = matches
    }
    return ordered
  }, [searchResult?.products, productSort, itemParam, debouncedQ])

  // Group products by supplier so the page is ordered (not a mix of many suppliers)
  const productsBySupplier = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of searchProductsWithPrice) {
      const sid = (p.supplier_account ?? p.supplier_name ?? "").toString().trim() || "Other"
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(p)
    }
    return Array.from(map.entries())
      .map(([supplierId, products]) => {
        const first = products[0]
        return {
          supplierId,
          supplierName: (first?.supplier_name ?? first?.supplier_account ?? supplierId).toString(),
          supplierLocation: first?.supplier_location,
          products,
        }
      })
      .filter((g) => g.products.length > 0)
  }, [searchProductsWithPrice])

  // Notify when watched products in search results have dropped in price
  const priceCheckItemsFromSearch = useMemo(() => {
    const seen = new Set<string>()
    const out: { productId: string; supplierId: string; currentPrice: number; name?: string }[] = []
    const add = (p: Product) => {
      const id = p.item_code || p.item_key_words || ""
      const sid = (p.supplier_account ?? "").toString()
      const key = `${id}|${sid}`
      if (!id || seen.has(key)) return
      seen.add(key)
      const price = productGeneralSellingPrice(p)
      if (price <= 0) return
      out.push({
        productId: id,
        supplierId: sid,
        currentPrice: price,
        name: p.item_commercial_name || undefined,
      })
    }
    searchProductsWithPrice.forEach(add)
    displayedSupplierProducts.forEach(add)
    return out
  }, [searchProductsWithPrice, displayedSupplierProducts])
  usePriceDropToasts(priceCheckItemsFromSearch)

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

  /** Drop `item` from URL but keep supplier + query so user can browse the full catalog. */
  const openSellerCatalogWithoutItem = () => {
    if (!selectedShop) return
    const params = new URLSearchParams()
    const term = debouncedQ.trim() || q.trim()
    if (term) params.set("q", term)
    params.set("supplier", selectedShop.supplier_account)
    params.set("supplierName", selectedShop.supplier_name)
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

  /** Deep-linked from global search (?item=&supplier=): minimal chrome; multiple matching lines still list in a grid. */
  const isFocusedProductView = Boolean(itemParam && supplierParam)

  const focusedSupplierLabel =
    selectedShop?.supplier_name ?? supplierNameParam ?? supplierParam ?? ""

  const startNewSearch = () => {
    setQ("")
    setDebouncedQ("")
    setSupplierSearch("")
    setSelectedShop(null)
    const params = new URLSearchParams()
    if (locationParam) params.set("location", locationParam)
    if (sectorParam) params.set("sector", sectorParam)
    const qs = params.toString()
    router.push(qs ? `/search?${qs}` : "/search")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-8">
        {!isFocusedProductView ? (
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Global Search</h1>
            <LocationBadge />
          </div>
        ) : (
          <div className="mb-6 w-full max-w-5xl mx-auto">
            {loadingProducts ? (
              <div className="space-y-3">
                <span className="inline-block h-8 w-48 max-w-full bg-muted animate-pulse rounded-md" aria-hidden />
                <span className="inline-block h-4 w-64 max-w-full bg-muted animate-pulse rounded-md" aria-hidden />
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Seller</p>
                  {focusedSupplierLabel ? (
                    <p className="text-lg font-semibold text-foreground mt-0.5">{focusedSupplierLabel}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    Review the product and add to cart below.
                  </p>
                </div>
                {/* <div className="flex flex-wrap gap-2 shrink-0"> */}
                  {/* <Button type="button" variant="outline" size="sm" onClick={openSellerCatalogWithoutItem}>
                    Browse all from this seller
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-blue-600" onClick={startNewSearch}>
                    New search
                  </Button> */}
                {/* </div> */}
              </div>
            )}
          </div>
        )}

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

        {!isFocusedProductView && (
          <>
        {/* Search Row — quick search: backend hit after 200ms debounce */}
        <div className="flex gap-2 items-center mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search in English or Kinyarwanda (e.g., water, amazi, honey, ubuki...)"
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(loading || (q.trim().length >= 2 && q.trim() !== debouncedQ)) && (
            <span className="text-sm opacity-60 animate-pulse whitespace-nowrap">Searching…</span>
          )}
        </div>

        {/* Search suggestions — from API (recent + popular), no hardcoding */}
        {suggestionTerms.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Suggestions:</span>
            {suggestionTerms.map((term) => (
              <button
                key={term}
                type="button"
                className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors"
                onClick={() => setQ(term)}
              >
                {term}
              </button>
            ))}
          </div>
        )}

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

            {/* Sector picker and quick location chips: hidden when a supplier is selected */}
            {!selectedShop && (
              <>
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
              </>
            )}
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
          </>
        )}

        {searchResult?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {searchResult.error}
          </div>
        )}

        {/* When item is not in NIKI (Redis), backend returns DB results; show hint */}
        {!isFocusedProductView && searchResult && (searchResult.products.length > 0 || searchResult.suppliersByName.length > 0 || searchResult.suppliersByProduct.length > 0) && (searchResult.source === "database" || searchResult.fromNiki === false) && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            Showing results from full catalog (not in NIKI cache).
          </div>
        )}

        {/* Location-Aware Search Indicator */}
        {!isFocusedProductView && (() => {
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

        <div className={cn("mx-auto max-w-5xl", isFocusedProductView && "w-full")}>
          {/* Main content (single column; no right sidebar) */}
          <div className="space-y-6">
            {/* Sector Spotlight */}
            {sectorParam && !isFocusedProductView && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {CATEGORY_IMAGES[sectorParam] && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={CATEGORY_IMAGES[sectorParam]}
                          alt={sectorParam.replace("-", " ")}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h2 className="font-semibold text-lg">
                      Sector spotlight — <span className="text-blue-700">{sectorParam.replace("-", " ")}</span>
                    </h2>
                  </div>
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
                          {s.products.slice(0, 3).map((p, idx) => {
                            const showPrice = productGeneralSellingPrice(p as Product)
                            return (
                            <div
                              key={`${p.item_code}-${p.supplier_account || s.seller_account}-${idx}`}
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
                                {showPrice > 0
                                  ? `${showPrice.toLocaleString()} ${p.currency || "RWF"}`
                                  : "Price not available"}
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Supplier products in main area when supplier selected */}
            {selectedShop && (
              <section
                className={cn(
                  "rounded-xl border bg-white p-4 sm:p-6",
                  itemParam && "border-0 bg-transparent p-0 shadow-none",
                )}
              >
                {!itemParam ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="space-y-1">
                      <h2 className="font-semibold text-lg">
                        Products from <span className="text-blue-700">{selectedShop.supplier_name}</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                      <input
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        placeholder={`Search in ${selectedShop.supplier_name}...`}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        aria-label="Search products from this supplier"
                      />
                      {(loadingSupplierSearch || (supplierSearch.trim() && supplierSearch.trim() !== debouncedSupplierSearch)) && (
                        <span className="text-xs text-gray-500 animate-pulse whitespace-nowrap">Searching…</span>
                      )}
                    </div>
                  </div>
                ) : null}
                {loadingProducts ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Loading products…</div>
                ) : loadingSupplierSearch && debouncedSupplierSearch.trim() ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Searching…</div>
                ) : displayedSupplierProducts.length > 0 ? (
                  <>
                    {!itemParam ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-sm text-gray-500">
                          Showing {supplierRangeStart}–{supplierRangeEnd} of {displayedSupplierProducts.length} product
                          {displayedSupplierProducts.length !== 1 ? "s" : ""}
                          {debouncedSupplierSearch.trim() ? ` matching "${debouncedSupplierSearch.trim()}"` : ""}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={String(supplierProductsPerPage)}
                            onValueChange={(v) => setSupplierProductsPerPage(Number(v))}
                          >
                            <SelectTrigger className="w-[120px] h-9" aria-label="Products per page">
                              <SelectValue placeholder="Per page" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 / page</SelectItem>
                              <SelectItem value="30">30 / page</SelectItem>
                              <SelectItem value="60">60 / page</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={supplierProductSort} onValueChange={(v: "relevance" | "price-asc" | "price-desc") => setSupplierProductSort(v)}>
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="relevance">Relevance</SelectItem>
                              <SelectItem value="price-asc">Price: Low to High</SelectItem>
                              <SelectItem value="price-desc">Price: High to Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : supplierTotalPages > 1 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-sm text-gray-500">
                          Showing {supplierRangeStart}–{supplierRangeEnd} of {displayedSupplierProducts.length} product
                          {displayedSupplierProducts.length !== 1 ? "s" : ""}
                        </p>
                        <Select
                          value={String(supplierProductsPerPage)}
                          onValueChange={(v) => setSupplierProductsPerPage(Number(v))}
                        >
                          <SelectTrigger className="w-[120px] h-9" aria-label="Products per page">
                            <SelectValue placeholder="Per page" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 / page</SelectItem>
                            <SelectItem value="30">30 / page</SelectItem>
                            <SelectItem value="60">60 / page</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "grid gap-4",
                        /* item+supplier deep link: spotlight cards are w-[280px]; auto-fill adds columns when width allows */
                        itemParam
                          ? "grid-cols-[repeat(auto-fill,minmax(280px,1fr))] justify-items-start"
                          : "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
                      )}
                    >
                      {paginatedSupplierProducts.map((p, index) =>
                        itemParam ? (
                          <div
                            key={`${p.item_code}-${p.supplier_account || ""}-${index}`}
                            className="flex justify-start"
                          >
                            <ProductCard
                              product={toCardProduct(p)}
                              layout="spotlight"
                              onQuickView={() => {
                                setQuickViewProduct(p)
                                setQuickViewOpen(true)
                              }}
                            />
                          </div>
                        ) : (
                          <div key={`${p.item_code}-${p.supplier_account || ""}-${index}`} className="relative">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => addProductToCart(p)}
                              onKeyDown={(e) => onTileKey(e, p)}
                              title="Click to add to cart"
                            >
                              <ProductCard product={toCardProduct(p)} />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute bottom-2 right-2 z-10 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setQuickViewProduct(p)
                                setQuickViewOpen(true)
                              }}
                            >
                              Quick view
                            </Button>
                          </div>
                        ),
                      )}
                    </div>
                    {supplierTotalPages > 1 ? (
                      <Pagination className="mt-6">
                        <PaginationContent className="flex-wrap justify-center gap-1">
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              className={supplierPageSafe <= 1 ? "pointer-events-none opacity-40" : undefined}
                              onClick={(e) => {
                                e.preventDefault()
                                setSupplierProductPage((p) => Math.max(1, p - 1))
                              }}
                            />
                          </PaginationItem>
                          {supplierPageList.map((item, idx) =>
                            item === "ellipsis" ? (
                              <PaginationItem key={`e-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={item}>
                                <PaginationLink
                                  href="#"
                                  size="icon"
                                  isActive={item === supplierPageSafe}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setSupplierProductPage(item)
                                  }}
                                >
                                  {item}
                                </PaginationLink>
                              </PaginationItem>
                            ),
                          )}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              className={supplierPageSafe >= supplierTotalPages ? "pointer-events-none opacity-40" : undefined}
                              onClick={(e) => {
                                e.preventDefault()
                                setSupplierProductPage((p) => Math.min(supplierTotalPages, p + 1))
                              }}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    ) : null}
                  </> 
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    {debouncedSupplierSearch.trim()
                      ? `No products matching "${debouncedSupplierSearch.trim()}"`
                      : "No products available from this supplier"}
                  </div>
                )}
              </section>
            )}

            {/* Products matching query — hidden when a supplier is selected (products from that supplier show above) */}
            {!selectedShop && searchResult && searchProductsWithPrice.length > 0 && (
              <section className="bg-white rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-lg">
                    Products matching "<span className="text-blue-700">{debouncedQ}</span>"
                  </h2>
                  <div className="flex items-center gap-2">
                    <Select value={productSort} onValueChange={(v: "relevance" | "price-asc" | "price-desc") => setProductSort(v)}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relevance">Relevance</SelectItem>
                        <SelectItem value="price-asc">Price: Low to High</SelectItem>
                        <SelectItem value="price-desc">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedShop && <Badge variant="outline">🔍 Supplier only</Badge>}
                    {locationParam && <Badge variant="secondary">📍 {locationParam}</Badge>}
                    {sectorParam && <Badge variant="secondary">🗂️ {sectorParam}</Badge>}
                    <span className="text-sm font-normal text-gray-500">
                      {searchProductsWithPrice.length} found
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {productsBySupplier.map(({ supplierId, supplierName, supplierLocation, products }) => (
                    <div key={supplierId} className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-700 border-b pb-1.5 flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {supplierName}
                        {supplierLocation && (
                          <span className="font-normal text-muted-foreground"> — {supplierLocation}</span>
                        )}
                        <span className="font-normal text-muted-foreground">({products.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {products.map((product, index) => (
                          <div key={`${product.item_code}-${product.supplier_account || ""}-${index}`} className="space-y-3">
                            {/* Debug: Log product data for search results */}
                            {(() => {
                              console.log("[Search] Product data for search results:", {
                                name: product.item_commercial_name,
                                item_key_words: product.item_key_words,
                                famille: (product as any).famille,
                                FAMILLE: (product as any).FAMILLE,
                                image_url: product.image_url,
                                item_image_url: product.item_image_url,
                                IMAGE_URL: (product as any).IMAGE_URL,
                                supplier: product.supplier_account
                              })
                              return null
                            })()}
                            <ProductCard
                              product={toCardProduct(product)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Suppliers — hidden when a supplier is already selected for cleaner UI */}
            {!selectedShop && allSuppliers.length > 0 && (
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
                      className="p-3 rounded-lg border cursor-pointer transition-all border-gray-200 hover:border-blue-300 hover:bg-gray-50"
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
              <div className="text-center py-8 text-gray-500 space-y-2">
                <p>No results found for &quot;{debouncedQ}&quot;</p>
                <p className="text-sm">Try a different search term, or check spelling (e.g. product name in English or Kinyarwanda).</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <ProductQuickView
        product={quickViewProduct ? toQuickViewProduct(quickViewProduct) : null}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        onAddToCart={(qv) => {
          const p = quickViewProduct
          if (p) addProductToCart(p)
          setQuickViewOpen(false)
        }}
      />
    </div>
  )
}