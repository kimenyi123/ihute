import { NextResponse } from "next/server"
import {
  getGrandmaSellerInventoryApiUrl,
  getGrandmaSellerInventoryApiUrlFallback,
  getProxyTimeoutMs,
} from "@/lib/backend-config"

export const runtime = "nodejs"

function targetUrl(req: Request, base: string): string {
  const u = new URL(req.url)
  const q = u.searchParams.toString()
  return q ? `${base}?${q}` : base
}

async function fetchKaosInventory(req: Request, urlPrimary: string): Promise<{ res: Response; url: string }> {
  const timeout = Math.max(getProxyTimeoutMs(), 60000)
  const init: RequestInit = { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeout) }
  let url = urlPrimary
  let res = await fetch(url, init)
  if (res.status === 404) {
    const fb = getGrandmaSellerInventoryApiUrlFallback()
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

/** Forwards quantity updates to Kaos — always POST upstream (Tomcat/proxy-safe). */
async function proxyQuantityToKaos(req: Request) {
  const rid = crypto.randomUUID()
  const primary = getGrandmaSellerInventoryApiUrl()
  try {
    const body = await req.json()
    const timeout = Math.max(getProxyTimeoutMs(), 60000)
    const postInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    }
    let url = primary
    let res = await fetch(url, postInit)
    if (res.status === 404) {
      const fb = getGrandmaSellerInventoryApiUrlFallback()
      if (fb) {
        const res2 = await fetch(fb, postInit)
        if (res2.status !== 404) {
          res = res2
          url = fb
        }
      }
    }
    const text = await res.text()
    const trimmed = text.trim().replace(/^\uFEFF/, "")
    let json: unknown
    try {
      json = trimmed ? JSON.parse(trimmed) : {}
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
    const payload = typeof json === "object" && json !== null ? { ...(json as object), rid } : { ok: false, rid }
    return NextResponse.json(payload, { status: res.status >= 500 ? 502 : res.status })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "error", rid },
      { status: 400 }
    )
  }
}

/** Proxies GET (list / searchNiki) and POST/PATCH (quantity) to Kaos {@link grandmaAPIs.GrandmaSellerInventoryServlet}. */
export async function GET(req: Request) {
  const rid = crypto.randomUUID()
  const primary = targetUrl(req, getGrandmaSellerInventoryApiUrl())
  try {
    const { res, url } = await fetchKaosInventory(req, primary)
    const text = await res.text()
    const trimmed = text.trim().replace(/^\uFEFF/, "")
    let json: unknown
    try {
      json = trimmed ? JSON.parse(trimmed) : {}
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
    const payload = typeof json === "object" && json !== null ? { ...(json as object), rid } : { ok: false, rid }
    return NextResponse.json(payload, { status: res.status >= 500 ? 502 : res.status })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: `Cannot reach inventory API: ${detail}`, code: "GRANDMA_UNREACHABLE", rid },
      { status: 503 }
    )
  }
}

export async function POST(req: Request) {
  return proxyQuantityToKaos(req)
}

/** @deprecated Prefer POST — kept for older clients; forwards as POST to Kaos. */
export async function PATCH(req: Request) {
  return proxyQuantityToKaos(req)
}
