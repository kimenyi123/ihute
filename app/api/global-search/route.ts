// app/api/global-search/route.ts
import type { NextRequest } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

function withTrailingSlash(u: string) { return u.endsWith("/") ? u : u + "/" }

async function forward(req: NextRequest) {
  const backendBase = withTrailingSlash(getBackendBase())
  const incoming = new URL(req.url)
  const target = new URL("/fetchSuggestions", backendBase)

  // copy query params
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

  const method = req.method
  const headers: Record<string,string> = {}
  const ct = req.headers.get("content-type")
  if (ct) headers["content-type"] = ct

  const body = method === "GET" || method === "HEAD" ? undefined : await req.text()

  console.log("[proxy] ->", target.toString(), method)

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15000) // 15s safety

  try {
    const resp = await fetch(target.toString(), { method, headers, body, signal: controller.signal, cache: "no-store" })
    const outBody = await resp.text()
    const contentType = resp.headers.get("content-type") ?? "application/json"
    return new Response(outBody, {
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
