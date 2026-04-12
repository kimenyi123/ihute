// app/api/global-search/route.ts
import type { NextRequest } from "next/server"
import { getBackendBase } from "@/lib/backend-config"
import {
  buildCacheKey,
  getCached,
  setCached,
  SUGGESTIONS_TTL_SEC,
} from "@/lib/redis-cache"
import { dedupeSearchProductsByItemCodeAndSellingPrice } from "@/lib/dedupe-search-products"
import { enrichFetchSuggestionsProducts } from "@/lib/fetch-suggestions-enrich"
import { stripExpiredFromFetchSuggestionsBody } from "@/lib/catalog-expiry-filter"

function withTrailingSlash(u: string) { return u.endsWith("/") ? u : u + "/" }

function paramsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  searchParams.forEach((v, k) => { out[k] = v })
  return out
}

async function forward(req: NextRequest) {
  const backendBase = withTrailingSlash(getBackendBase())
  const incoming = new URL(req.url)
  const target = new URL("/fetchSuggestions", backendBase)

  // copy query params (backend must always search Redis first, then DB)
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

  // Redis first (this app): same response cache as /api/fetchSuggestions
  const cacheKey = buildCacheKey("fetchSuggestions", paramsToRecord(incoming.searchParams))
  const cached = await getCached(cacheKey)
  if (cached) {
    console.log("[global-search] Redis cache hit")
    try {
      const parsed = JSON.parse(cached) as { products?: unknown[] }
      const globalSearchQ = incoming.searchParams.get("globalSearch")?.trim()
      if (
        globalSearchQ &&
        Array.isArray(parsed.products) &&
        parsed.products.length > 1
      ) {
        parsed.products = dedupeSearchProductsByItemCodeAndSellingPrice(parsed.products)
      }
      enrichFetchSuggestionsProducts(parsed)
      stripExpiredFromFetchSuggestionsBody(parsed)
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
      /* invalid JSON — fall through */
    }
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

  const method = req.method
  const headers: Record<string,string> = {}
  const ct = req.headers.get("content-type")
  if (ct) headers["content-type"] = ct

  const body = method === "GET" || method === "HEAD" ? undefined : await req.text()

  console.log("[global-search] Redis miss ->", target.toString(), method)

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15000) // 15s safety

  try {
    const resp = await fetch(target.toString(), { method, headers, body, signal: controller.signal, cache: "no-store" })
    const outBody = await resp.text()
    const contentType = resp.headers.get("content-type") ?? "application/json"
    let responseBody = outBody
    if (resp.ok) {
      try {
        const parsed = JSON.parse(outBody) as { products?: unknown[] }
        const globalSearchQ = incoming.searchParams.get("globalSearch")?.trim()
        if (
          globalSearchQ &&
          Array.isArray(parsed.products) &&
          parsed.products.length > 1
        ) {
          parsed.products = dedupeSearchProductsByItemCodeAndSellingPrice(parsed.products)
        }
        enrichFetchSuggestionsProducts(parsed)
        stripExpiredFromFetchSuggestionsBody(parsed)
        responseBody = JSON.stringify(parsed)
        await setCached(cacheKey, responseBody, SUGGESTIONS_TTL_SEC)
      } catch {
        // not JSON, don't cache
      }
    }
    return new Response(responseBody, {
      status: resp.status,
      headers: {
        "content-type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (err: any) {
    console.error("Backend fetch error:", err?.message || err)
    return new Response(JSON.stringify({ error: "Backend service unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })
  } finally {
    clearTimeout(t)
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
