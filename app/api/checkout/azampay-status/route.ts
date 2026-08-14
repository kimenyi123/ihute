import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BASE = getServerProxyBackendBase()

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const pgReferenceId = sp.get("pgReferenceId")?.trim() || sp.get("pg_reference_id")?.trim()
    const referenceId =
      sp.get("referenceId")?.trim() ||
      sp.get("reference_id")?.trim() ||
      sp.get("merchantReferenceId")?.trim()
    const orderId = sp.get("orderId")?.trim() || sp.get("ihute_order_id")?.trim()

    if (!pgReferenceId && !referenceId && !orderId) {
      return NextResponse.json(
        { ok: false, error: "pgReferenceId, referenceId, or orderId is required" },
        { status: 400 },
      )
    }

    const params = new URLSearchParams()
    if (pgReferenceId) params.set("pgReferenceId", pgReferenceId)
    if (referenceId) params.set("referenceId", referenceId)
    if (orderId) params.set("orderId", orderId)

    const url = `${JAVA_BASE}/api/checkout/azampay-status?${params.toString()}`
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AzamPay status check failed"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
