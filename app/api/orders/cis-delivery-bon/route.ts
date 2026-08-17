import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * CIS / POS → IHUTE: POST a printed delivery bon (livraison id e.g. LIV-896).
 * Forwards to Kaos OrdersServlet?action=ingestCisDeliveryBon
 *
 * Headers: X-CIS-Api-Key (optional unless CIS_DELIVERY_API_KEY is set on Tomcat)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "JSON body required" }, { status: 400 })
  }

  const publicSiteUrl =
    String(body.publicSiteUrl ?? "").trim() ||
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  if (publicSiteUrl && !body.publicSiteUrl) {
    body = { ...body, publicSiteUrl }
  }

  const url = new URL(getOrdersUrl())
  url.searchParams.set("action", "ingestCisDeliveryBon")

  const apiKey =
    req.headers.get("x-cis-api-key") ||
    req.headers.get("x-ihute-api-key") ||
    req.headers.get("x-api-key") ||
    process.env.CIS_DELIVERY_API_KEY ||
    ""

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(apiKey ? { "X-CIS-Api-Key": apiKey } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from backend" }))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status >= 400 ? res.status : 502 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to ingest CIS bon"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
