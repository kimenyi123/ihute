import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Proxy CIS → IHUTE fiscal invoice sync (SDC/MRC). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const publicSiteUrl =
    String(body.publicSiteUrl ?? "").trim() ||
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ihute.rw"

  const url = new URL(getOrdersUrl())
  url.searchParams.set("action", "syncCisInvoice")

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  const apiKey =
    req.headers.get("x-cis-api-key") ||
    req.headers.get("x-ihute-api-key") ||
    process.env.CIS_DELIVERY_API_KEY ||
    ""
  if (apiKey) headers["X-CIS-Api-Key"] = apiKey

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, publicSiteUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to sync CIS invoice"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
