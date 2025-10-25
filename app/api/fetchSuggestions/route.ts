// app/api/fetchSuggestions/route.ts
import type { NextRequest } from "next/server"

const DEFAULT_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 45000)

function withTrailingSlash(u: string) {
  return u.endsWith("/") ? u : u + "/"
}

async function forward(req: NextRequest) {
  const backendBase = withTrailingSlash(process.env.JAVA_BACKEND_BASE ?? "https://ihute.rw/Trading")
  const incoming = new URL(req.url)
  const target = new URL("Kaos/fetchSuggestions", backendBase)

  // copy query params
  incoming.searchParams.forEach((v, k) => target.searchParams.append(k, v))

  const method = req.method
  const headers: Record<string, string> = {}
  const ct = req.headers.get("content-type")
  if (ct) headers["content-type"] = ct
  const accept = req.headers.get("accept")
  if (accept) headers["accept"] = accept

  const body = method === "GET" || method === "HEAD" ? undefined : await req.text()

  const isConfirmPayment = target.searchParams.get("action")?.toLowerCase() === "confirmpayment"

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const resp = await fetch(target.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    })

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
    // If confirmPayment is slow, let UI proceed (Cart/Orders will pull later)
    if (err?.name === "AbortError" && isConfirmPayment) {
      const tempId = `TEMP-${Date.now()}`
      return new Response(JSON.stringify({ ok: true, deferred: true, orderId: tempId }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    console.error("Backend fetch error:", err?.message || err)
    return new Response(JSON.stringify({ ok: false, error: "Backend service unavailable" }), {
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
