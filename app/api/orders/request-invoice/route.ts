import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  const orderId = String(body.orderId ?? req.nextUrl.searchParams.get("orderId") ?? "").trim()
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
  }

  const publicSiteUrl =
    String(body.publicSiteUrl ?? "").trim() ||
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  const requestedBy = String(body.requestedBy ?? body.buyerEmail ?? "").trim()

  const url = new URL(getOrdersUrl())
  url.searchParams.set("action", "requestInvoice")

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: Number(orderId) || orderId, requestedBy, publicSiteUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to request invoice"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
