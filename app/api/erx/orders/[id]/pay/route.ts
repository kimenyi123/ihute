import { NextRequest, NextResponse } from "next/server"

import { createMomoPaymentIntent } from "@/adapters/momo"
import { getOrder, payOrder, snapshotOrder } from "@/lib/erx/erx-order-store"
import { notifyRespondersAfterPay } from "@/lib/erx/erx-pos-channel"
import type { ErxDeliveryMode } from "@/lib/erx/erx-market-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/erx/orders/{id}/pay {momo, delivery} — creates the MoMo payment
 * intent (adapters/momo.ts — stubbed until the rail is wired), places the eRx
 * lines on HOLD with 4h auto-release, and notifies every pharmacy that
 * replied on the POS channel: chosen → serve; others → order closed, release
 * reservation.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: { momo?: string; delivery?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_BAD_JSON" }, { status: 400 })
  }

  const order = getOrder(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  if (!order.chosenPharmacyId) {
    return NextResponse.json({ ok: false, code: "ERX_NO_PHARMACY_CHOSEN" }, { status: 409 })
  }

  const chosen = order.quotes.find((q) => q.pharmacy.id === order.chosenPharmacyId)
  if (!chosen) {
    return NextResponse.json({ ok: false, code: "ERX_QUOTE_NOT_FOUND" }, { status: 409 })
  }

  const deliveryRaw = (body.delivery || "pharmacy").trim()
  let mode: ErxDeliveryMode = "pharmacy"
  let fee = chosen.deliveryFee
  let riderId: string | null = null
  if (deliveryRaw === "pickup") {
    mode = "pickup"
    fee = 0
  } else if (deliveryRaw !== "pharmacy") {
    const rider = order.riderOffers.find((r) => r.id === deliveryRaw)
    if (!rider) {
      return NextResponse.json({ ok: false, code: "ERX_RIDER_NOT_FOUND" }, { status: 409 })
    }
    mode = "rider"
    fee = rider.fee
    riderId = rider.id
  }

  const goods = Math.round(chosen.goods * (1 - chosen.discountPct / 100))
  let momoRef: string
  try {
    const intent = await createMomoPaymentIntent({
      phone: body.momo || "",
      amountRwf: goods + fee,
      orderId: id,
      description: `IHUTE eRx ${order.erxCode}`,
    })
    momoRef = intent.ref
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: (e as Error).message || "MOMO_FAILED" },
      { status: 400 },
    )
  }

  const paid = payOrder(id, { momoRef, delivery: { mode, fee, riderId } })
  if (!paid) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }

  // Chosen pharmacy serves; every other responder releases its reservation.
  void notifyRespondersAfterPay({
    orderId: id,
    erxCode: paid.erxCode,
    chosenPharmacyId: paid.chosenPharmacyId as string,
    responderPharmacyIds: paid.responders.map((r) => r.pharmacyId),
  })

  return NextResponse.json({ ok: true, order: snapshotOrder(id) })
}
