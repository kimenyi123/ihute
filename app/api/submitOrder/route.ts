import { NextResponse } from "next/server"

import { getSellerOrdersUrl } from "@/lib/backend-config"

const JAVA_SELLER_ORDERS_URL = getSellerOrdersUrl()

export async function POST(req: Request) {
  try {
    const { sellerAccount, orderId } = await req.json()
    if (!sellerAccount || !orderId) {
      return NextResponse.json({ ok: false, error: "sellerAccount and orderId required" }, { status: 400 })
    }
    if (!JAVA_SELLER_ORDERS_URL) {
      return NextResponse.json({ ok: false, error: "JAVA_SELLER_ORDERS_URL not configured" }, { status: 500 })
    }

    const params = new URLSearchParams()
    params.set("action", "listSellerOrderItems")
    params.set("sellerAccount", String(sellerAccount))
    params.set("orderId", String(orderId))

    const res = await fetch(JAVA_SELLER_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: json?.error || `Failed to load` }, { status: 502 })
    }
    // { ok:true, order:{...}, items:[...], buyer:{...} }
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 400 })
  }
}
