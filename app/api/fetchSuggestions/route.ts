// app/api/fetchSuggestions/route.ts
import type { NextRequest } from "next/server"
import { getFetchSuggestionsUrl, getProxyTimeoutMs } from "@/lib/backend-config"

const DEFAULT_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

async function forward(req: NextRequest) {
  const incoming = new URL(req.url)
  const target = new URL(getFetchSuggestionsUrl())

  // Copy query params
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

  // Log so you can confirm the exact URL hit by Kaos (check terminal where Next runs)
  console.log("[fetchSuggestions] Forwarding to backend:", target.toString())

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
      throw new Error(`Backend responded with status: ${resp.status}`)
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
      const redisCount = sources.filter(s => s.includes("redis")).length
      const dbCount = sources.filter(s => s.includes("database") || s.includes("stock") || s.includes("niki")).length
      const otherCount = total - redisCount - dbCount
      console.log("[fetchSuggestions] source summary:", {
        totalProducts: total,
        redisCount,
        dbCount,
        otherCount,
      })
    }

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
      ok: false, 
      error: "Backend service unavailable",
      suppliersByName: [],
      suppliersByProduct: [], 
      products: [],
      query: incoming.searchParams.get('globalSearch') || ''
    }), {
      status: 503,
      headers: { "content-type": "application/json" },
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