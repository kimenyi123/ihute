// app/api/fetchSuggestions/route.ts
import type { NextRequest } from "next/server"

const DEFAULT_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 30000) // Reduced to 30s

async function forward(req: NextRequest) {
  const backendBase = process.env.JAVA_BACKEND_BASE ?? "https://ihute.rw/Trading"
  const incoming = new URL(req.url)
  const target = new URL(`${backendBase}/Kaos/fetchSuggestions`)

  // Copy query params
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

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
    
    // Validate JSON response
    try {
      JSON.parse(outBody)
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

    return new Response(outBody, {
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