import { NextResponse } from "next/server"

import { getOrdersUrl } from "@/lib/backend-config"

const JAVA_URL = getOrdersUrl()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Expected:
    // {
    //   sellerId, sellerName, momo, amount, items: [{id,name,qty,price,unit}],
    //   buyerEmail?, buyerPhone?, deliveryLocation?,
    //   paymentName?, paymentId?, orderStatus?
    // }

    if (!JAVA_URL) {
      return NextResponse.json({ ok: true, orderId: `ORD-${Date.now()}`, mocked: true })
    }

    const params = new URLSearchParams()
    params.set("action", "confirmPayment")
    params.set("sellerId", String(body.sellerId ?? ""))
    params.set("sellerName", String(body.sellerName ?? ""))
    params.set("momo", String(body.momo ?? ""))
    params.set("amount", String(body.amount ?? ""))
    params.set("buyerEmail", String(body.buyerEmail ?? ""))
    params.set("buyerPhone", String(body.buyerPhone ?? ""))
    params.set("deliveryLocation", String(body.deliveryLocation ?? ""))
    params.set("paymentName", String(body.paymentName ?? "MTN_MOMO")) // e.g. PAY_ON_DELIVERY
    params.set("paymentId", String(body.paymentId ?? ""))
    params.set("orderStatus", String(body.orderStatus ?? "")) // optional
    params.set("items", JSON.stringify(body.items ?? []))

    const res = await fetch(JAVA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    let json: any = null
    try {
      json = await res.json()
    } catch {
      if (res.ok) return NextResponse.json({ ok: true, orderId: `ORD-${Date.now()}` })
      return NextResponse.json({ ok: false, error: `Servlet HTTP ${res.status}` }, { status: 502 })
    }

    if (!res.ok || json?.ok === false) {
      return NextResponse.json({ ok: false, error: json?.error || `Servlet HTTP ${res.status}` }, { status: 502 })
    }

    const orderId = json.orderId || `ORD-${Date.now()}`
    return NextResponse.json({ ok: true, orderId, data: json })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 400 })
  }
}
