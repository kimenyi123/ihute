import { NextRequest, NextResponse } from "next/server"

import { createMomoPaymentIntent } from "@/adapters/momo"
import { getOrder, payOrder, snapshotOrder } from "@/lib/erx/erx-order-store"
import { notifyRespondersAfterPay } from "@/lib/erx/erx-pos-channel"
import { updateErxOrderPayment } from "@/lib/erx/erx-pos-payment"
import type { ErxDeliveryMode } from "@/lib/erx/erx-market-types"
import {
  extractMoMoTxIdFromSms,
  matchMoMoSmsToOrderTotal,
  normalizePaymentBank,
} from "@/lib/momo-payment-sms-match"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function paymentNameFromSms(sms: string): string {
  return normalizePaymentBank(sms)
}

/**
 * POST /api/erx/orders/{id}/pay
 * Grandma-style: paste MoMo SMS → extract txId + payment rail → HOLD + update
 * order_transaction.PAYMENT_NAME + payment_id on the chosen pharmacy row.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: {
    momo?: string
    delivery?: string
    momoSms?: string
    txId?: string
    paymentName?: string
  }
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
  const totalRwf = goods + fee

  const sms = (body.momoSms || "").trim()
  let txId = (body.txId || "").trim()
  let paymentName = (body.paymentName || "").trim().toLowerCase()

  if (sms) {
    const match = matchMoMoSmsToOrderTotal(sms, totalRwf, 2)
    if (!match.matched) {
      return NextResponse.json(
        {
          ok: false,
          code: "ERX_MOMO_SMS_MISMATCH",
          rejectReason: match.rejectReason,
          amount: match.amount,
          expected: totalRwf,
        },
        { status: 400 },
      )
    }
    txId = match.txId || txId
    paymentName = paymentNameFromSms(sms)
  }

  if (!txId) {
    txId = extractMoMoTxIdFromSms(sms) || ""
  }
  if (!paymentName) paymentName = "momo"
  if (!txId) {
    return NextResponse.json({ ok: false, code: "ERX_MOMO_TXID_REQUIRED" }, { status: 400 })
  }

  let momoRef: string
  try {
    const intent = await createMomoPaymentIntent({
      phone: body.momo || "",
      amountRwf: totalRwf,
      orderId: id,
      description: `IHUTE eRx ${order.erxCode}`,
    })
    momoRef = intent.ref || txId
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: (e as Error).message || "MOMO_FAILED" },
      { status: 400 },
    )
  }

  const orderNumber =
    order.posOrderNumbers[order.chosenPharmacyId] || `${id}-${order.chosenPharmacyId}`
  void updateErxOrderPayment({
    orderNumber,
    paymentName,
    paymentId: txId,
  }).catch((e) => {
    console.warn("[erx/pay] order_transaction payment update failed:", e)
  })

  const paid = payOrder(id, {
    momoRef: txId || momoRef,
    paymentName,
    delivery: { mode, fee, riderId },
  })
  if (!paid) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }

  void notifyRespondersAfterPay({
    orderId: id,
    erxCode: paid.erxCode,
    chosenPharmacyId: paid.chosenPharmacyId as string,
    responderPharmacyIds: paid.responders.map((r) => r.pharmacyId),
  })

  return NextResponse.json({ ok: true, order: snapshotOrder(id), paymentName, txId })
}
