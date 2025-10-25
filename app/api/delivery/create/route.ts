import { NextResponse } from "next/server"

// e.g. https://your-java-host/Kaos/orders
const JAVA_ORDERS_URL = process.env.JAVA_ORDERS_URL || "http://localhost:8080/Trading/OrdersServlet"

export async function POST(req: Request) {
  try {
    if (!JAVA_ORDERS_URL) {
      return NextResponse.json({ ok: false, error: "JAVA_ORDERS_URL not configured" }, { status: 500 })
    }

    const body = await req.json()
    const {
      buyerEmail,
      buyerPhone,
      buyerLocation,   // optional
      sellerAccount,   // REQUIRED (ISHYIGA_ACCOUNT)
      sellerName,      // optional
      sellerPhone,     // optional
      reference,       // optional
      currency = "RWF",
      items = [],      // [{ name, qty, unitPrice, unit? }]
      paymentName = "PAY_ON_DELIVERY", // COD by default
      paymentId = "",  // empty for COD
    } = body || {}

    if (!buyerEmail || !sellerAccount || !items?.length) {
      return NextResponse.json({ ok: false, error: "buyerEmail, sellerAccount, items required" }, { status: 400 })
    }

    const params = new URLSearchParams()
    params.set("action", "createOrder")
    params.set("buyerEmail", buyerEmail)
    params.set("buyerPhone", String(buyerPhone || ""))
    params.set("buyerLocation", String(buyerLocation || ""))
    params.set("sellerAccount", String(sellerAccount))
    if (sellerName)  params.set("sellerName", String(sellerName))
    if (sellerPhone) params.set("sellerPhone", String(sellerPhone))
    if (reference)   params.set("reference", String(reference))
    params.set("currency", String(currency))
    params.set("paymentName", String(paymentName))
    params.set("paymentId", String(paymentId))
    params.set("items", JSON.stringify(items)) // servlet expects JSON string

    const res = await fetch(JAVA_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: json?.error || "Failed to create order" }, { status: 502 })
    }
    return NextResponse.json(json) // { ok:true, orderId }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 400 })
  }
}
