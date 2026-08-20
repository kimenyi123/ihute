// app/api/fetchSuggestions/route.ts
import type { NextRequest } from "next/server"
import {
  getFetchSuggestionsUrl,
  getProxyTimeoutMs,
  getSearchBackendDiagnostics,
  warmJavaBackendBase,
} from "@/lib/backend-config"
import {
  buildCacheKey,
  getCached,
  setCached,
  SUGGESTIONS_TTL_SEC,
} from "@/lib/redis-cache"
import { dedupeSearchProductsByItemCodeAndSellingPrice } from "@/lib/dedupe-search-products"
import { dedupeCrossShopByItemCode, logCrossShopDedupeDetails } from "@/lib/cross-shop-dedupe"
import { enrichFetchSuggestionsProducts } from "@/lib/fetch-suggestions-enrich"
import { stripExpiredFromFetchSuggestionsBody } from "@/lib/catalog-expiry-filter"
import { recordSearchEvent } from "@/lib/mysql-search-analytics"
import { shouldRunTextSearch } from "@/lib/search-query-min"
import {
  buildSearchError,
  classifySearchUpstreamFailure,
  normalizeSearchSuccess,
  searchErrorResponse,
} from "@/lib/search-api-contract"

/**
 * Global search can spend ~8–15s on Redis (many supplier_* blobs) plus NIKI MySQL.
 * A cap near 10–12s aborts before the servlet returns 72 DB rows → empty UI + "took too long".
 */
const DEFAULT_TIMEOUT_MS = Math.min(90000, Math.max(35000, getProxyTimeoutMs()))

function paramsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  searchParams.forEach((v, k) => {
    out[k] = v
  })
  return out
}

/** When set, Kaos logs SQL and may return `_debugSql` + `X-SectorStats-*` headers; Next skips its Redis cache. */
function isDebugSql(params: URLSearchParams): boolean {
  const v = params.get("debugSql")?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

function applyGlobalSearchDedupe(
  parsed: { products?: unknown[] },
  globalSearchQ: string | undefined,
  redisHit: boolean,
  keepAllShops = false,
): void {
  if (!globalSearchQ || !parsed?.products) return
  const safeTerm = globalSearchQ.trim().replace(/"/g, "'")
  const rawResults = parsed.products.length
  parsed.products = dedupeSearchProductsByItemCodeAndSellingPrice(parsed.products) as typeof parsed.products
  const afterLot = parsed.products?.length ?? 0
  let afterCross = afterLot
  if (!keepAllShops) {
    parsed.products = dedupeCrossShopByItemCode(parsed.products ?? []) as typeof parsed.products
    afterCross = parsed.products?.length ?? 0
  }
  console.log(
    `[cache][global] term="${safeTerm}" redis_hit=${redisHit} locateShops=${keepAllShops} raw_results=${rawResults} after_lot_dedupe=${afterLot} after_crossshop_dedupe=${afterCross}`,
  )
  if (!keepAllShops) {
    logCrossShopDedupeDetails(parsed.products ?? [], globalSearchQ)
  }
  if (rawResults !== afterCross) {
    console.log(
      "[fetchSuggestions] Cross-shop dedupe:",
      rawResults,
      "→",
      afterCross,
      "| globalSearch",
    )
  }
}

function fireMainSearchEvent(req: NextRequest, term: string, resultsCount: number): void {
  void recordSearchEvent({
    term,
    source: "main_search",
    shop_nickname: null,
    results_count: resultsCount,
    session_id: req.cookies.get("ihute_sid")?.value ?? null,
  }).catch(() => {})
}

const SECTOR_STATS_DEBUG_HEADER_NAMES = [
  "x-sectorstats-shops-sql",
  "x-sectorstats-items-sql",
  "x-sectorstats-category-like-binds",
  "x-sectorstats-debug-cache-phase",
] as const

/** Kaos `?sectorStats=pharmacy` returns `{ ok, sector, shops, items }` — must not be replaced by empty-search JSON. */
function sectorStatsErrorBody(sectorSlug: string, warning: string): string {
  return JSON.stringify({
    ok: true,
    sector: sectorSlug.trim(),
    shops: 0,
    items: 0,
    warning,
  })
}

async function forward(req: NextRequest) {
  const incoming = new URL(req.url)
  const query = incoming.searchParams.get("globalSearch")?.trim() || ""
  let target: URL
  try {
    await warmJavaBackendBase()
    target = new URL(getFetchSuggestionsUrl())
  } catch {
    console.error("[fetchSuggestions] Backend configuration is invalid")
    return searchErrorResponse(
      503,
      buildSearchError(
        "SEARCH_BACKEND_UNAVAILABLE",
        "UPSTREAM_UNAVAILABLE",
        "Search service is temporarily unavailable.",
        query,
      ),
    )
  }
  const globalSearchRaw = incoming.searchParams.get("globalSearch")?.trim() ?? ""
  if (globalSearchRaw && !shouldRunTextSearch(globalSearchRaw)) {
    return new Response(
      JSON.stringify({
        ok: true,
        suppliersByName: [],
        suppliersByProduct: [],
        products: [],
        query: globalSearchRaw,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "X-Search-Skipped": "min-length",
        },
      },
    )
  }
  const sectorStatsParam = incoming.searchParams.get("sectorStats")
  const debugSql = isDebugSql(incoming.searchParams)
  const supplierProductsParamEarly = incoming.searchParams.get("supplierProducts")?.trim() || ""
  const limitN = Number(incoming.searchParams.get("limit"))
  /** Sector totals (`shops` / `items`) must track stock syncs; do not serve a 5‑min cached snapshot here. */
  /** Full-shop catalog (Grandma page 3): bypass stale Redis snapshots capped at old limits. */
  const skipSuggestionsCache =
    Boolean(sectorStatsParam?.trim()) ||
    debugSql ||
    (Boolean(supplierProductsParamEarly) && Number.isFinite(limitN) && limitN >= 1000)
  // Copy query params. Backend must always search Redis first, then DB (see docs/backend-redis-search.md).
  // Category, brand, price: frontend sends category, brand, priceMin, priceMax; backend can filter by them.
  // See docs/backend-category-price-filters.md for SQL/API guidance.
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))
  target.searchParams.delete("locateShops")
  target.searchParams.delete("keepAllShops")

  // Redis first (this app): check our response cache before calling backend (DB)
  const keepAllShops =
    incoming.searchParams.get("locateShops") === "1" ||
    incoming.searchParams.get("keepAllShops") === "1"
  const cacheKey = buildCacheKey("fetchSuggestions", paramsToRecord(incoming.searchParams))
  const cached = skipSuggestionsCache ? null : await getCached(cacheKey)
  if (cached) {
    console.log("[fetchSuggestions] Redis cache hit")
    try {
      const parsed = JSON.parse(cached) as { products?: unknown[] }
      const globalSearchQ = incoming.searchParams.get("globalSearch")?.trim()
      if (globalSearchQ) {
        const normalized = normalizeSearchSuccess(parsed, globalSearchQ)
        if (!normalized) throw new Error("Invalid cached search response")
        Object.assign(parsed, normalized)
      }
      // Drop expired lots first so dedupe never picks an expired row as representative when a valid batch exists.
      stripExpiredFromFetchSuggestionsBody(parsed)
      applyGlobalSearchDedupe(parsed, globalSearchQ, true, keepAllShops)
      enrichFetchSuggestionsProducts(parsed)
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "X-Cache": "HIT",
        },
      })
    } catch {
      // Corrupted/non-JSON cache entry (e.g. upstream HTML error page accidentally cached).
      // Do not return raw cached content as JSON; treat as cache miss and fetch fresh data.
      console.warn("[fetchSuggestions] Invalid JSON in Redis cache; bypassing cached value")
    }
  }

  // Cache miss: call backend (DB), then store in Redis
  const backendDiagnostics = getSearchBackendDiagnostics()
  console.log("[fetchSuggestions] Redis miss, forwarding to backend", {
    configuredBy: backendDiagnostics.configuredBy,
    host: backendDiagnostics.host,
    context: backendDiagnostics.context,
    endpointPath: backendDiagnostics.endpointPath,
    valid: backendDiagnostics.valid,
    debugSql,
  })

  const method = req.method
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (method !== "GET" && method !== "HEAD") {
    const ct = req.headers.get("content-type")
    headers["Content-Type"] = ct && ct.trim() ? ct : "application/json"
  }

  const body = method === "GET" || method === "HEAD" ? undefined : await req.text()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const resp = await fetch(target.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.warn("[fetchSuggestions] Backend returned", resp.status, ", not masking as empty sector data")
      if (sectorStatsParam) {
        return new Response(
          JSON.stringify({
            ok: false,
            sector: sectorStatsParam.trim(),
            shops: 0,
            items: 0,
            error: "Sector stats unavailable (backend HTTP " + resp.status + ")",
          }),
          {
            status: resp.status >= 400 ? resp.status : 503,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          }
        )
      }
      return searchErrorResponse(
        502,
        buildSearchError(
          "SEARCH_BACKEND_UNAVAILABLE",
          "UPSTREAM_UNAVAILABLE",
          "Search service is temporarily unavailable.",
          query,
        ),
      )
    }

    const outBody = await resp.text()

    if (sectorStatsParam && debugSql) {
      console.log("[fetchSuggestions][sectorStats-DEBUG] upstream endpoint", getSearchBackendDiagnostics())
      for (const hn of SECTOR_STATS_DEBUG_HEADER_NAMES) {
        const hv = resp.headers.get(hn)
        if (hv) {
          console.log(`[fetchSuggestions][sectorStats-DEBUG] header ${hn}:`, hv)
        }
      }
    }

    // Validate JSON response and log where results come from (redis vs database) based on product.source
    let parsed: any
    try {
      parsed = JSON.parse(outBody)
    } catch (e) {
      console.error("[fetchSuggestions] Backend returned invalid JSON")
      if (sectorStatsParam) {
        return new Response(sectorStatsErrorBody(sectorStatsParam, "Invalid JSON from backend for sectorStats"), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        })
      }
      return searchErrorResponse(
        502,
        buildSearchError(
          "SEARCH_INVALID_UPSTREAM_RESPONSE",
          "BAD_GATEWAY",
          "Search service returned an invalid response.",
          query,
        ),
      )
    }

    if (query) {
      if (Array.isArray(parsed)) {
        return searchErrorResponse(
          502,
          buildSearchError(
            "SEARCH_INVALID_UPSTREAM_RESPONSE",
            "BAD_GATEWAY",
            "Search service returned an invalid response.",
            query,
          ),
        )
      }
      const normalized = normalizeSearchSuccess(parsed, query)
      if (!normalized) {
        return searchErrorResponse(
          502,
          buildSearchError(
            "SEARCH_INVALID_UPSTREAM_RESPONSE",
            "BAD_GATEWAY",
            "Search service returned an invalid response.",
            query,
          ),
        )
      }
      parsed = normalized
    }

    const supplierProductsParam = incoming.searchParams.get("supplierProducts")?.trim() || ""
    if (Array.isArray(parsed)) {
      console.log(
        "[fetchSuggestions] Data source: array payload | rows:",
        parsed.length,
        supplierProductsParam ? `| supplierProducts=${supplierProductsParam}` : "",
      )
    } else if (parsed && Array.isArray(parsed.products)) {
      const sources = parsed.products
        .map((p: any) => String(p?.source || "").toLowerCase() || "unknown")
      const total = sources.length
      const redisCount = sources.filter((s: string) => s.includes("redis")).length
      const dbCount = sources.filter((s: string) => s.includes("database") || s.includes("stock") || s.includes("niki")).length
      const otherCount = total - redisCount - dbCount
      const dataSource = redisCount > 0 && dbCount === 0 ? "redis" : dbCount > 0 && redisCount === 0 ? "database" : redisCount > 0 && dbCount > 0 ? "mixed" : "unknown"
      const supplierParam = incoming.searchParams.get("supplier") || ""
      
      // Debug: Check first few products for item_key_words and famille
      console.log("[fetchSuggestions] Data source:", dataSource, "| Products:", total, "| redis:", redisCount, "db:", dbCount, "other:", otherCount, supplierParam ? "| supplier=" + supplierParam : "")
      
      if (parsed.products.length > 0) {
        const sampleProduct = parsed.products[0]
        console.log("[fetchSuggestions] Sample product fields:", {
          item_key_words: sampleProduct.item_key_words,
          famille: sampleProduct.famille,
          FAMILLE: sampleProduct.FAMILLE,
          image_url: sampleProduct.image_url,
          item_image_url: sampleProduct.item_image_url,
          IMAGE_URL: sampleProduct.IMAGE_URL,
          image: sampleProduct.image,
          source: sampleProduct.source
        })
        
        // Check if critical fields are null/undefined
        if (sampleProduct.item_key_words == null) {
          console.warn("[fetchSuggestions] WARNING: item_key_words is null/undefined in first product!")
        }
        if (sampleProduct.famille == null && sampleProduct.FAMILLE == null) {
          console.warn("[fetchSuggestions] WARNING: Both famille and FAMILLE are null/undefined in first product!")
        }
      }
    } else if (parsed) {
      const supplierParam = incoming.searchParams.get("supplier") || ""
      console.log(
        "[fetchSuggestions] Data source: unknown (no products array) | supplier=" +
          (supplierParam || "n/a") +
          (supplierProductsParam ? " | supplierProducts=" + supplierProductsParam : ""),
      )
    }

    if (sectorStatsParam && debugSql && parsed && typeof parsed === "object" && parsed._debugSql != null) {
      console.log("[fetchSuggestions][sectorStats-DEBUG] JSON _debugSql:", JSON.stringify(parsed._debugSql, null, 2))
    }

    stripExpiredFromFetchSuggestionsBody(parsed ?? {})

    const globalSearchQ = incoming.searchParams.get("globalSearch")?.trim()
    applyGlobalSearchDedupe(parsed ?? {}, globalSearchQ, false, keepAllShops)

    enrichFetchSuggestionsProducts(parsed ?? {})

    if (globalSearchQ) {
      const count = Array.isArray(parsed?.products) ? parsed.products.length : 0
      fireMainSearchEvent(req, globalSearchQ, count)
    }

    // Store in Redis for next time (Redis first, then DB) — skip sectorStats (fresh counts) and debugSql
    if (!skipSuggestionsCache) {
      await setCached(cacheKey, JSON.stringify(parsed ?? {}), SUGGESTIONS_TTL_SEC)
    }

    const resHeaders = new Headers({
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    })
    if (sectorStatsParam && debugSql) {
      let anySectorDebugHeader = false
      for (const hn of SECTOR_STATS_DEBUG_HEADER_NAMES) {
        const hv = resp.headers.get(hn)
        if (hv) {
          resHeaders.set(hn, hv)
          anySectorDebugHeader = true
        }
      }
      if (anySectorDebugHeader) {
        resHeaders.set(
          "Access-Control-Expose-Headers",
          "X-SectorStats-Shops-Sql, X-SectorStats-Items-Sql, X-SectorStats-Category-Like-Binds, X-SectorStats-Debug-Cache-Phase",
        )
      }
    }

    return new Response(JSON.stringify(parsed ?? {}), {
      status: resp.status,
      headers: resHeaders,
    })
  } catch (err: any) {
    console.error("Backend fetch error:", err?.message || err)
    
    if (err?.name === "AbortError") {
      if (sectorStatsParam) {
        return new Response(
          sectorStatsErrorBody(sectorStatsParam, "Sector stats request timed out"),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        )
      }
      return searchErrorResponse(
        504,
        buildSearchError(
          "SEARCH_BACKEND_TIMEOUT",
          "TIMEOUT",
          "Search service timed out.",
          query,
        ),
      )
    }

    if (sectorStatsParam) {
      return new Response(
        sectorStatsErrorBody(sectorStatsParam, "Sector stats service is temporarily unavailable."),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      )
    }

    const classified = classifySearchUpstreamFailure(err, query)
    return searchErrorResponse(classified.status, classified.body)
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(req: NextRequest)  { return forward(req) }
export async function POST(req: NextRequest) { return forward(req) }
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}