// app/api/fetchSuggestions/route.ts
import type { NextRequest } from "next/server"
import { getFetchSuggestionsUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import {
  buildCacheKey,
  getCached,
  setCached,
  SUGGESTIONS_TTL_SEC,
} from "@/lib/redis-cache"

const DEFAULT_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

function paramsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  searchParams.forEach((v, k) => {
    out[k] = v
  })
  return out
}

async function forward(req: NextRequest) {
  const incoming = new URL(req.url)
  const target = new URL(getFetchSuggestionsUrl())

  // Copy query params. Backend must always search Redis first, then DB (see docs/backend-redis-search.md).
  // Category, brand, price: frontend sends category, brand, priceMin, priceMax; backend can filter by them.
  // See docs/backend-category-price-filters.md for SQL/API guidance.
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

  // Redis first (this app): check our response cache before calling backend (DB)
  const cacheKey = buildCacheKey("fetchSuggestions", paramsToRecord(incoming.searchParams))
  const cached = await getCached(cacheKey)
  if (cached) {
    console.log("[fetchSuggestions] Redis cache hit")
    return new Response(cached, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "X-Cache": "HIT",
      },
    })
  }

  // Cache miss: call backend (DB), then store in Redis
  console.log("[fetchSuggestions] Redis miss, forwarding to backend:", target.toString())

  const method = req.method
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
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
      const outBody = await resp.text()
      console.warn("[fetchSuggestions] Backend returned", resp.status, ", returning empty results")
      return new Response(JSON.stringify({
        ok: true,
        suppliersByName: [],
        suppliersByProduct: [],
        products: [],
        query: incoming.searchParams.get('globalSearch') || '',
        warning: "Search service temporarily unavailable"
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    const outBody = await resp.text()

    // Validate JSON response and log where results come from (redis vs database) based on product.source
    let parsed: any
    try {
      parsed = JSON.parse(outBody)
    } catch (e) {
      console.error("Invalid JSON from backend:", outBody.substring(0, 200))
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Invalid response format from backend",
        suppliersByName: [],
        suppliersByProduct: [], 
        products: [],
        query: incoming.searchParams.get('globalSearch') || ''
      }), {
        status: 502,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    if (parsed && Array.isArray(parsed.products)) {
      const sources = parsed.products
        .map((p: any) => String(p?.source || "").toLowerCase() || "unknown")
      const total = sources.length
      const redisCount = sources.filter((s: string) => s.includes("redis")).length
      const dbCount = sources.filter((s: string) => s.includes("database") || s.includes("stock") || s.includes("niki")).length
      const otherCount = total - redisCount - dbCount
      const dataSource = redisCount > 0 && dbCount === 0 ? "redis" : dbCount > 0 && redisCount === 0 ? "database" : redisCount > 0 && dbCount > 0 ? "mixed" : "unknown"
      const supplierParam = incoming.searchParams.get("supplier") || ""
      console.log("[fetchSuggestions] Data source:", dataSource, "| Products:", total, "| redis:", redisCount, "db:", dbCount, "other:", otherCount, supplierParam ? "| supplier=" + supplierParam : "")
    } else if (parsed) {
      const supplierParam = incoming.searchParams.get("supplier") || ""
      console.log("[fetchSuggestions] Data source: unknown (no products array) | supplier=" + (supplierParam || "n/a"))
    }

    // Store in Redis for next time (Redis first, then DB)
    await setCached(cacheKey, JSON.stringify(parsed ?? {}), SUGGESTIONS_TTL_SEC)

    return new Response(JSON.stringify(parsed ?? {}), {
      status: resp.status,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (err: any) {
    console.error("Backend fetch error:", err?.message || err)
    
    // Return empty results instead of error for search timeouts
    if (err?.name === "AbortError") {
      return new Response(JSON.stringify({
        ok: true,
        suppliersByName: [],
        suppliersByProduct: [],
        products: [],
        query: incoming.searchParams.get('globalSearch') || '',
        warning: "Search took too long, please try again with more specific terms"
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      suppliersByName: [],
      suppliersByProduct: [],
      products: [],
      query: incoming.searchParams.get('globalSearch') || '',
      warning: "Search service temporarily unavailable"
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
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