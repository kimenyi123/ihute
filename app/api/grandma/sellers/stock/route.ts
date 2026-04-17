import { NextResponse } from "next/server"
import { getGrandmaSellerStockApiUrl, getProxyTimeoutMs } from "@/lib/backend-config"

export const runtime = "nodejs"

/** Proxies bulk stock insert to Tomcat {@code GrandmaSellerStockServlet}. */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()
  const url = getGrandmaSellerStockApiUrl()

  try {
    const body = await req.json()
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(Math.max(getProxyTimeoutMs(), 60000)),
      })
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      console.error(`[RID ${rid}] Grandma seller stock unreachable`, e)
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot reach seller stock API (${url}). ${detail}`,
          code: "GRANDMA_STOCK_UNREACHABLE",
          rid,
        },
        { status: 503 }
      )
    }

    const text = await res.text()
    const trimmed = text.trim().replace(/^\uFEFF/, "")
    let json: unknown
    try {
      json = trimmed ? JSON.parse(trimmed) : {}
    } catch {
      const preview = trimmed.slice(0, 500)
      console.error(`[RID ${rid}] Grandma stock non-JSON HTTP ${res.status} ${url}`, preview)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tomcat returned HTML or non-JSON (often HTTP 404 — deploy latest trading_ai.war with /Api/grandma/sellers/stock, or fix BACKEND_URL).",
          code: "GRANDMA_NOT_JSON",
          upstreamStatus: res.status,
          upstreamUrl: url,
          raw: trimmed.slice(0, 600),
          rid,
        },
        { status: 502 }
      )
    }

    const payload = typeof json === "object" && json !== null ? { ...(json as object), rid } : { ok: false, rid }
    const statusOut = res.status >= 500 ? 502 : res.status
    console.log(`[RID ${rid}] Grandma seller stock -> ${res.status} in ${Date.now() - t0}ms`)
    return NextResponse.json(payload, { status: statusOut })
  } catch (e: unknown) {
    console.error(`[RID ${rid}] /api/grandma/sellers/stock`, e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown error", rid },
      { status: 400 }
    )
  }
}
