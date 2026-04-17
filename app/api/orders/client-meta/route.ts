import { NextRequest, NextResponse } from "next/server"
import { getOrderMeta, normalizeOrderIdKey, patchOrderClientMeta } from "@/lib/order-client-meta-store"

export async function GET(req: NextRequest) {
  try {
    const orderId = String(new URL(req.url).searchParams.get("orderId") ?? "").trim()
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })
    }
    const canonical = normalizeOrderIdKey(orderId)
    const meta = getOrderMeta(orderId)
    return NextResponse.json({ ok: true, orderId: canonical || orderId, meta: meta ?? {} })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId ?? "").trim()
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })
    }

    const patch: {
      buyerDeliveryAddress?: string | null
      sellerPaymentAck?: "paid" | "pending" | null
    } = {}

    if ("buyerDeliveryAddress" in body) {
      patch.buyerDeliveryAddress =
        body.buyerDeliveryAddress == null ? null : String(body.buyerDeliveryAddress)
    }
    if ("sellerPaymentAck" in body) {
      const v = body.sellerPaymentAck
      if (v == null) patch.sellerPaymentAck = null
      else if (v === "paid" || v === "pending") patch.sellerPaymentAck = v
      else {
        return NextResponse.json({ ok: false, error: "sellerPaymentAck must be paid, pending, or null" }, { status: 400 })
      }
    }

    if (!("buyerDeliveryAddress" in body) && !("sellerPaymentAck" in body)) {
      return NextResponse.json({ ok: false, error: "No updates: send buyerDeliveryAddress and/or sellerPaymentAck" }, { status: 400 })
    }

    const meta = patchOrderClientMeta(orderId, patch)
    const canonical = normalizeOrderIdKey(orderId)
    return NextResponse.json({ ok: true, orderId: canonical || orderId, meta })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
