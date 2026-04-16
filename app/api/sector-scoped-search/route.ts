import type { NextRequest } from "next/server"
import { getProxyTimeoutMs, getSectorScopedSearchUrl } from "@/lib/backend-config"

const DEFAULT_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url)
  const target = new URL(getSectorScopedSearchUrl())
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v))

  const t0 = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const resp = await fetch(target.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
    const text = await resp.text()
    const proxyRtMs = Math.round(performance.now() - t0)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid JSON from backend",
          proxyRtMs,
          backendStatus: resp.status,
        }),
        { status: 502, headers: { "content-type": "application/json" } },
      )
    }
    body.proxyRtMs = proxyRtMs
    body.nextRtMs = proxyRtMs
    return new Response(JSON.stringify(body), {
      status: resp.ok ? 200 : resp.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Rt-Ms": String(proxyRtMs),
      },
    })
  } catch (e) {
    const proxyRtMs = Math.round(performance.now() - t0)
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(
      JSON.stringify({ ok: false, error: msg, proxyRtMs, nextRtMs: proxyRtMs }),
      { status: 502, headers: { "content-type": "application/json" } },
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
