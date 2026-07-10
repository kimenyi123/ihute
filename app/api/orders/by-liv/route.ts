import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/orders/by-liv?livId=LIV-896 — proxy to kaos OrdersServlet?livid=… */
export async function GET(req: NextRequest) {
  const livId =
    req.nextUrl.searchParams.get("livId")?.trim() ||
    req.nextUrl.searchParams.get("livid")?.trim() ||
    req.nextUrl.searchParams.get("PAYMENT_ID")?.trim() ||
    ""
  if (!livId) {
    return NextResponse.json({ ok: false, error: "livId is required (e.g. LIV-896)" }, { status: 400 })
  }

  const publicSiteUrl =
    req.nextUrl.searchParams.get("publicSiteUrl")?.trim() ||
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""

  const url = new URL(getOrdersUrl())
  url.searchParams.set("livid", livId)
  if (publicSiteUrl) url.searchParams.set("publicSiteUrl", publicSiteUrl)

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
    const status = res.ok && (data as { ok?: boolean }).ok !== false ? 200 : res.status === 404 ? 404 : res.ok ? 404 : res.status
    return NextResponse.json(data, { status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load bon by livId"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
