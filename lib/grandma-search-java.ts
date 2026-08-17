/**
 * Grandma Search via dedicated Java `/grandma/search` (no Next.js MySQL).
 *
 * Browser → GET /api/grandma/search → this module → Java servlet → Kaos MySQL.
 * Ranking, fuzzy, prefix autocomplete, and Haversine stay in Next.js.
 */
import {
  getGrandmaSearchUrl,
  getGrandmaSearchUrlFallback,
  getProxyTimeoutMs,
} from "@/lib/backend-config"
import { haversineKm, isValidLatLng } from "@/lib/geo-haversine"
import {
  clampGrandmaSearchQuery,
  GRANDMA_FULL_SEARCH_MIN_CHARS,
  GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
  GRANDMA_SEARCH_CANDIDATE_CAP,
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
  GRANDMA_SUGGEST_LIMIT,
  isRelevantGrandmaSearchHit,
  normalizeSearchText,
  rankGrandmaSearchHit,
  shopWithinNearMeRadius,
  type GrandmaSearchParams,
  type GrandmaSearchResult,
  type GrandmaSearchShopHit,
} from "@/lib/grandma-search"
import {
  displayGrandmaShopName,
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  resolveSellerDisplayCategory,
} from "@/lib/seller-category-sector"

export type GrandmaJavaFetch = (url: string, init?: RequestInit) => Promise<Response>

let javaFetchImpl: GrandmaJavaFetch = (url, init) => fetch(url, init)

/** Test-only fetch override. Pass null to restore. */
export function setGrandmaJavaFetchForTests(fn: GrandmaJavaFetch | null): void {
  javaFetchImpl = fn ?? ((url, init) => fetch(url, init))
}

type JavaShopRow = {
  sellerAccount: string
  ownerName: string
  nickname: string
  description: string
  categories: string
  department: string
  momo: string
  latitude: number | null
  longitude: number | null
  distanceKm: number | null
  productSample?: string
}

type JavaSearchPayload = {
  shops: JavaShopRow[]
  suggestions: string[]
}

function timeoutMs(): number {
  return Math.min(8000, Math.max(3000, getProxyTimeoutMs()))
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s
  }
  return ""
}

function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null || v === "") continue
    const n = typeof v === "number" ? v : Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function sellerAccountOf(row: Record<string, unknown>): string {
  return str(
    row,
    "ISHYIGA_ACCOUNT",
    "seller_account",
    "SELLER_ISHYIGA_ACCOUNT",
    "supplier_account",
    "supplierAccount",
    "sellerAccount",
  )
}

function parseShopRow(raw: unknown): JavaShopRow | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const sellerAccount = sellerAccountOf(row)
  if (!sellerAccount) return null
  const nickname = str(row, "nickname", "NICKNAME", "nickName")
  const ownerName = str(row, "seller_name", "OWNER", "owner", "supplier_name")
  const lat = num(row, "supplier_latitude", "latitude", "lat", "LATITUDE")
  const lng = num(row, "supplier_longitude", "longitude", "lng", "LONGITUDE")
  return {
    sellerAccount,
    ownerName,
    nickname,
    description: str(row, "DESCRIPTION", "description", "tagline"),
    categories: str(row, "PREFEREDCATEGORIES", "PREFERRED_CATEGORIES", "preferred_categories", "category"),
    department: str(row, "DEPARTMENT", "department"),
    momo: str(row, "seller_momo", "momo", "MOMO"),
    latitude: isValidLatLng(lat, lng) ? lat : null,
    longitude: isValidLatLng(lat, lng) ? lng : null,
    distanceKm: null,
    productSample:
      str(row, "item_commercial_name", "ITEM_NAME", "matchedProduct", "matchedProductSample") || undefined,
  }
}

function parsePayload(data: unknown): JavaSearchPayload {
  const shops: JavaShopRow[] = []
  const suggestions: string[] = []
  if (!data || typeof data !== "object") return { shops, suggestions }
  const o = data as Record<string, unknown>
  const shopArr = Array.isArray(o.shops) ? o.shops : Array.isArray(data) ? data : []
  for (const raw of shopArr) {
    const shop = parseShopRow(raw)
    if (shop) shops.push(shop)
  }
  if (Array.isArray(o.suggestions)) {
    for (const s of o.suggestions) {
      const t = String(s ?? "").trim()
      if (t && t.toLowerCase() !== "null") suggestions.push(t)
    }
  }
  return { shops, suggestions }
}

async function javaGetJson(url: string): Promise<{ status: number; data: unknown }> {
  const res = await javaFetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs()),
  })
  const text = await res.text()
  const trimmed = text.trim().replace(/^\uFEFF/, "")
  if (!trimmed) return { status: res.status, data: [] }
  try {
    return { status: res.status, data: JSON.parse(trimmed) }
  } catch {
    return { status: res.status, data: null }
  }
}

function searchUrl(
  params: {
    q: string
    sector: string
    suggestOnly: boolean
    lat?: number
    lng?: number
  },
  base: string,
): string {
  const u = new URL(base)
  if (params.q) u.searchParams.set("q", params.q)
  if (params.sector) u.searchParams.set("sector", params.sector)
  u.searchParams.set("limit", String(GRANDMA_SEARCH_CANDIDATE_CAP))
  if (params.suggestOnly) u.searchParams.set("suggest", "1")
  if (isValidLatLng(params.lat, params.lng)) {
    u.searchParams.set("latitude", String(params.lat))
    u.searchParams.set("longitude", String(params.lng))
  }
  return u.toString()
}

async function fetchGrandmaJavaSearch(params: {
  q: string
  sector: string
  suggestOnly: boolean
  lat?: number
  lng?: number
}): Promise<{ payload: JavaSearchPayload; unreachable: boolean }> {
    const primary = searchUrl(params, getGrandmaSearchUrl())
  try {
    let { status, data } = await javaGetJson(primary)
    if (status === 404) {
      const fb = getGrandmaSearchUrlFallback()
      if (fb) {
        const second = await javaGetJson(searchUrl(params, fb))
        status = second.status
        data = second.data
      }
    }
    if (status >= 500 || data == null) {
      return { payload: { shops: [], suggestions: [] }, unreachable: true }
    }
    if (typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === false) {
      return { payload: { shops: [], suggestions: [] }, unreachable: status >= 500 }
    }
    return { payload: parsePayload(data), unreachable: false }
  } catch {
    return { payload: { shops: [], suggestions: [] }, unreachable: true }
  }
}

function applyBuyerDistance(shop: JavaShopRow, lat?: number, lng?: number): JavaShopRow {
  if (!isValidLatLng(lat, lng) || !isValidLatLng(shop.latitude, shop.longitude)) {
    return { ...shop, distanceKm: null }
  }
  return {
    ...shop,
    distanceKm: haversineKm(Number(lat), Number(lng), Number(shop.latitude), Number(shop.longitude)),
  }
}

function sectorToCategoryLabel(sector: string): string {
  const hit = Object.entries(GRANDMA_CATEGORY_TO_SECTOR_SLUG).find(([, v]) => v === sector)
  return hit?.[0] ?? "Others"
}

function toHit(shop: JavaShopRow, qRaw: string, sector: string): GrandmaSearchShopHit | null {
  const shopName = displayGrandmaShopName(shop.nickname, shop.ownerName, shop.sellerAccount)
  const ranked = rankGrandmaSearchHit(qRaw || shopName, {
    shopName,
    sellerName: shop.ownerName,
    description: shop.description,
    category: shop.categories || shop.department,
    tags: [shop.categories, shop.department].filter(Boolean).join(" "),
    brand: shop.nickname,
    productBlob: shop.productSample,
  })
  if (qRaw && !isRelevantGrandmaSearchHit(ranked.score, qRaw, ranked.tier)) return null
  const catLabel = sector
    ? sectorToCategoryLabel(sector)
    : resolveSellerDisplayCategory(shop.categories, shop.department, shopName)
  const distanceKm =
    shop.distanceKm != null && Number.isFinite(shop.distanceKm)
      ? Math.round(shop.distanceKm * 10) / 10
      : null
  return {
    id: `supplier_${shop.sellerAccount}__${String(catLabel).replace(/\s+/g, "_")}`,
    sellerAccount: shop.sellerAccount,
    name: shopName,
    sellerName: shop.ownerName,
    category: catLabel,
    tagline: shop.description && shop.description !== "NA" ? shop.description.slice(0, 80) : "Local supplier",
    description: shop.description,
    momo: shop.momo ? `MTN MoMo: ${shop.momo}` : "",
    nickname: shop.nickname,
    latitude: isValidLatLng(shop.latitude, shop.longitude) ? shop.latitude : null,
    longitude: isValidLatLng(shop.latitude, shop.longitude) ? shop.longitude : null,
    distanceKm,
    score: qRaw ? ranked.score : 0,
    matchTier: qRaw ? ranked.tier : "none",
    highlights: ranked.highlights,
    matchedProductSample: shop.productSample,
  }
}

function emptyResult(
  qRaw: string,
  page: number,
  pageSize: number,
  nearMe: boolean,
  radiusKm: number | null,
  suggestions: string[],
  emptyReason: string | null,
): GrandmaSearchResult {
  return {
    ok: true,
    source: "java",
    query: qRaw,
    shops: [],
    suggestions: suggestions.slice(0, GRANDMA_SUGGEST_LIMIT),
    page,
    pageSize,
    total: 0,
    hasMore: false,
    radiusKm: nearMe ? radiusKm : null,
    nearMe,
    emptyReason,
  }
}

export async function runGrandmaSearch(
  params: GrandmaSearchParams,
): Promise<GrandmaSearchResult | { ok: false; error: string; code: string }> {
  const qRaw = clampGrandmaSearchQuery(String(params.q ?? "").trim())
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || GRANDMA_SEARCH_DEFAULT_PAGE_SIZE))
  const nearMe = Boolean(params.nearMe)
  const hasGeo = isValidLatLng(params.lat, params.lng)
  const radiusKm =
    params.radiusKm == null || !Number.isFinite(Number(params.radiusKm))
      ? null
      : Math.max(0.1, Number(params.radiusKm))
  const sector = String(params.sector || params.category || "").trim()
  const suggestOnly =
    Boolean(params.suggestOnly) ||
    (Boolean(params.suggest) && qRaw.length > 0 && qRaw.length < GRANDMA_FULL_SEARCH_MIN_CHARS && !nearMe)
  const wantSuggestions = (params.suggest || suggestOnly) && qRaw.length >= 1

  const { payload, unreachable } = await fetchGrandmaJavaSearch({
    q: qRaw,
    sector,
    suggestOnly: suggestOnly || (wantSuggestions && qRaw.length < GRANDMA_FULL_SEARCH_MIN_CHARS && !nearMe),
    lat: hasGeo ? params.lat : undefined,
    lng: hasGeo ? params.lng : undefined,
  })

  if (unreachable) {
    return { ok: false, error: GRANDMA_PUBLIC_SEARCH_UNAVAILABLE, code: "JAVA_UNREACHABLE" }
  }

  const suggestions = wantSuggestions
    ? payload.suggestions.slice(0, GRANDMA_SUGGEST_LIMIT)
    : []

  if (suggestOnly || (qRaw.length > 0 && qRaw.length < GRANDMA_FULL_SEARCH_MIN_CHARS && !nearMe)) {
    return emptyResult(qRaw, 1, pageSize, nearMe, radiusKm, suggestions, null)
  }

  const ranked: GrandmaSearchShopHit[] = []
  const seen = new Set<string>()
  for (const shop of payload.shops.map((s) => applyBuyerDistance(s, params.lat, params.lng))) {
    const key = shop.sellerAccount.toUpperCase()
    if (seen.has(key)) continue
    const hit = toHit(shop, qRaw, sector)
    if (!hit) continue
    if (!shopWithinNearMeRadius(hit.distanceKm, { nearMe, radiusKm })) continue
    seen.add(key)
    ranked.push(hit)
  }

  if (qRaw.length >= 2) {
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (nearMe && a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
      return a.name.localeCompare(b.name)
    })
  } else if (nearMe) {
    ranked.sort((a, b) => {
      const da = a.distanceKm != null && Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY
      const db = b.distanceKm != null && Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY
      return da - db
    })
  }

  const capped = ranked.slice(0, GRANDMA_SEARCH_CANDIDATE_CAP)
  const offset = (page - 1) * pageSize
  const visible = capped.slice(offset, offset + pageSize)
  let emptyReason: string | null = null
  if (visible.length === 0) {
    if (nearMe && hasGeo && radiusKm != null && qRaw) emptyReason = "no_match_in_radius"
    else if (nearMe && hasGeo && radiusKm != null) emptyReason = "no_shops_in_radius"
    else if (qRaw) emptyReason = "no_text_match"
    else emptyReason = "empty"
  }

  return {
    ok: true,
    source: "java",
    query: qRaw,
    shops: visible,
    suggestions,
    page,
    pageSize,
    total: capped.length,
    hasMore: offset + visible.length < capped.length,
    radiusKm: nearMe ? radiusKm : null,
    nearMe,
    emptyReason,
  }
}
