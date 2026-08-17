import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Public cart helper: which item/NIKI codes require a prescription.
 * Uses kaos OrdersServlet → MySQLConnector (same WAR DB as search).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { codes?: unknown }
  const codes = Array.isArray(body.codes)
    ? body.codes.map((c) => String(c || "").trim()).filter(Boolean).slice(0, 80)
    : []
  if (codes.length === 0) {
    return NextResponse.json({ ok: true, codes: [] })
  }
  try {
    const url = new URL(getOrdersUrl())
    url.searchParams.set("action", "itemsRequirePrescription")
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    const data = await res.json().catch(() => null)
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok) {
      return NextResponse.json(data)
    }
    return NextResponse.json(
      { ok: false, error: "Could not check prescription flags", codes: [] },
      { status: 502 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backend unavailable"
    return NextResponse.json({ ok: false, error: msg, codes: [] }, { status: 502 })
  }
}
