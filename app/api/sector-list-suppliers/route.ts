import type { NextRequest } from "next/server"
import { getProxyTimeoutMs, getSectorListSuppliersUrl } from "@/lib/backend-config"

const DEFAULT_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

/**
 * Proxies to Tomcat {@code /Kaos/sectorListSuppliers} — same JSON array as legacy
 * {@code fetchSuggestions?listSuppliersWithProducts=}, with Tomcat timing headers forwarded.
 */
export async function GET(req: NextRequest) {
  const incoming = new URL(req.url)
  const target = new URL(getSectorListSuppliersUrl())
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

    const headers = new Headers()
    headers.set("content-type", resp.headers.get("content-type") || "application/json; charset=utf-8")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    headers.set("X-Proxy-Rt-Ms", String(proxyRtMs))
    const lswpRt = resp.headers.get("X-LSWP-Rt-Ms")
    const lswpCache = resp.headers.get("X-LSWP-Cache")
    const sectorEp = resp.headers.get("X-Sector-List-Endpoint")
    if (lswpRt) headers.set("X-LSWP-Rt-Ms", lswpRt)
    if (lswpCache) headers.set("X-LSWP-Cache", lswpCache)
    if (sectorEp) headers.set("X-Sector-List-Endpoint", sectorEp)

    return new Response(text, {
      status: resp.ok ? 200 : resp.status,
      headers,
    })
  } catch (e) {
    const proxyRtMs = Math.round(performance.now() - t0)
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg, proxyRtMs }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
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
