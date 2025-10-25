import { NextResponse } from "next/server"

// Force this to be a true server function (no static opt.)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Prefer env; fallback covers both /OrdersServlet and /Kaos/OrdersServlet styles
const JAVA_URL =
  (process.env.JAVA_ORDERS_URL ||
   process.env.JAVA_SERVLET_URL ||
   // try Kaos/OrdersServlet first since many apps map Kaos servlets that way:
   "https://ihute.rw/Trading/Kaos/OrdersServlet")

// Simple GET probe: visit http://localhost:3000/api/orders/create to confirm not-404
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/orders/create", java: JAVA_URL })
}

type LineIn = {
  name?: string
  item_name?: string
  qty?: number | string
  quantity?: number | string
  unitPrice?: number | string
  price?: number | string
  unit?: string
  measurement?: string
}

export async function POST(req: Request) {
  try {
    // Guard: route must exist even if body is bad
    const body = await req.json().catch(() => ({} as any))

    // Normalize items to { name, qty, unitPrice, unit }
    const rawItems: LineIn[] = Array.isArray(body.items) ? body.items : []
    const items = rawItems.map((it, i) => ({
      name: (it.name ?? it.item_name ?? `Item ${i + 1}`) as string,
      qty: Number(it.qty ?? it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unit: (it.unit ?? it.measurement ?? "") as string,
    }))

    const buyerEmail = String(body.buyerEmail ?? "")
    const sellerAccount = String(body.sellerAccount ?? "")

    if (!buyerEmail || !sellerAccount || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "buyerEmail, sellerAccount and items are required" },
        { status: 400 }
      )
    }

    const params = new URLSearchParams()
    params.set("action", "createOrder")
    params.set("buyerEmail", buyerEmail)
    params.set("buyerPhone", String(body.buyerPhone ?? ""))
    params.set("buyerLocation", String(body.buyerLocation ?? "NA"))
    params.set("sellerAccount", sellerAccount)                       // ISHYIGA account
    if (body.sellerName) params.set("sellerName", String(body.sellerName))
    if (body.sellerPhone) params.set("sellerPhone", String(body.sellerPhone))
    params.set("paymentName", String(body.paymentName ?? "PAY_ON_DELIVERY"))
    params.set("paymentId", String(body.paymentId ?? ""))
    params.set("reference", String(body.reference ?? ""))
    params.set("currency", String(body.currency ?? "RWF"))
    params.set("items", JSON.stringify(items))

    // Helpful logs while you’re wiring things up
    console.log("[orders/create] -> POST", JAVA_URL)
    console.log("[orders/create] body:", {
      buyerEmail,
      sellerAccount,
      paymentName: String(body.paymentName ?? "PAY_ON_DELIVERY"),
      itemsCount: items.length,
    })

    const res = await fetch(JAVA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    })

    const text = await res.text()
    let json: any
    try { json = JSON.parse(text) } catch { /* keep raw text */ }

    console.log("[orders/create] <- Java status:", res.status)
    if (!res.ok || json?.ok === false) {
      return NextResponse.json(
        { ok: false, error: json?.error || `Servlet HTTP ${res.status}`, raw: text.slice(0, 800) },
        { status: 502 }
      )
    }

    // Expect Java to return { ok:true, orderId }
    const orderId = json?.orderId || `ORD-${Date.now()}`
    return NextResponse.json({ ok: true, orderId })
  } catch (e: any) {
    console.error("[orders/create] error:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
