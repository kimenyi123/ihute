import { NextResponse } from "next/server"
import { getGrandmaSellerTempItemApiUrl, getProxyTimeoutMs } from "@/lib/backend-config"

export const runtime = "nodejs"

/** Proxies POST to Kaos {@link grandmaAPIs.GrandmaSellerTempItemServlet}. */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const url = getGrandmaSellerTempItemApiUrl()
  try {
    const body = await req.json()
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(getProxyTimeoutMs(), 60000)),
    })
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
