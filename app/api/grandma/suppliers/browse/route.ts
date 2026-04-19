import { NextResponse } from "next/server"
import {
  getGrandmaListSuppliersBrowseUrl,
  getGrandmaListSuppliersBrowseUrlFallback,
  getProxyTimeoutMs,
} from "@/lib/backend-config"

export const runtime = "nodejs"

function targetUrl(req: Request, base: string): string {
  const u = new URL(req.url)
  const q = u.searchParams.toString()
  return q ? `${base}?${q}` : base
}

async function fetchBrowse(req: Request, primary: string): Promise<{ res: Response; url: string }> {
  const timeout = Math.max(getProxyTimeoutMs(), 60000)
  const init: RequestInit = { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeout) }
  let url = primary
  let res = await fetch(url, init)
  if (res.status === 404) {
    const fb = getGrandmaListSuppliersBrowseUrlFallback()
    if (fb) {
      const u = new URL(req.url)
      const q = u.searchParams.toString()
      const tryUrl = q ? `${fb}?${q}` : fb
      const res2 = await fetch(tryUrl, init)
      if (res2.status !== 404) {
        return { res: res2, url: tryUrl }
      }
    }
  }
  return { res, url }
}

/** Proxies GET to {@link grandmaAPIs.GrandmaListSuppliersServlet} — JSON array or error object from Kaos. */
export async function GET(req: Request) {
  const rid = crypto.randomUUID()
  const primary = targetUrl(req, getGrandmaListSuppliersBrowseUrl())
  try {
    const { res, url } = await fetchBrowse(req, primary)
    const text = await res.text()
    const trimmed = text.trim().replace(/^\uFEFF/, "")

    const headers = new Headers()
    headers.set("Content-Type", "application/json; charset=utf-8")
    const cacheHdr = res.headers.get("X-Grandma-Cache")
    if (cacheHdr) {
      headers.set("X-Grandma-Cache", cacheHdr)
    }
    headers.set("X-Proxy-Request-Id", rid)

    let parsed: unknown
    try {
      parsed = trimmed ? JSON.parse(trimmed) : []
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Tomcat returned non-JSON",
          code: "GRANDMA_NOT_JSON",
          upstreamUrl: url,
          upstreamStatus: res.status,
          raw: trimmed.slice(0, 800),
          rid,
        },
        { status: 502 }
      )
    }

    const status = res.status >= 500 ? 502 : res.status
    return new NextResponse(JSON.stringify(parsed), { status, headers })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: `Cannot reach suppliers browse API: ${detail}`, code: "GRANDMA_UNREACHABLE", rid },
      { status: 503 }
    )
  }
}
