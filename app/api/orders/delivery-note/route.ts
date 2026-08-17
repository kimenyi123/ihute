import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
  }
  const publicSiteUrl =
    req.nextUrl.searchParams.get("publicSiteUrl")?.trim() ||
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""

  const url = new URL(getOrdersUrl())
  url.searchParams.set("action", "getDeliveryNote")
  url.searchParams.set("orderId", orderId)
  if (publicSiteUrl) url.searchParams.set("publicSiteUrl", publicSiteUrl)

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load delivery note"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
