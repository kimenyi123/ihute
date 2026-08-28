import { NextRequest, NextResponse } from "next/server"

import { chooseQuote, snapshotOrder } from "@/lib/erx/erx-order-store"
import { insertErxTracking } from "@/lib/erx/erx-tracking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/erx/orders/{id}/choose {pharmacyId} — opens the pay screen; rider offers start arriving. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: { pharmacyId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_BAD_JSON" }, { status: 400 })
  }
  const pharmacyId = (body.pharmacyId || "").trim()
  if (!pharmacyId) {
    return NextResponse.json({ ok: false, code: "ERX_PHARMACY_REQUIRED" }, { status: 400 })
  }
  const order = chooseQuote(id, pharmacyId)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  const picked = order.quotes.find((q) => q.pharmacyId === pharmacyId)
  void insertErxTracking({
    eventType: "CHOOSE",
    erxCode: order.erxCode,
    status: "SUCCESS",
    orderId: id,
    pickedPharmacyId: pharmacyId,
    pickedPharmacyName: picked?.pharmacyName ?? pharmacyId,
    serviceStage: "QUOTES",
    requestedAt: new Date(),
    respondedAt: new Date(),
  })
  return NextResponse.json({ ok: true, order: snapshotOrder(id) })
}
