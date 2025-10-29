import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Primary candidates (your web.xml maps both)
const CANDIDATES = [
  process.env.JAVA_ORDERS_URL,
  process.env.JAVA_SERVLET_URL,
  "https://ihute.rw/Trading/OrdersServlet",
  "https://ihute.rw/Trading/Kaos/OrdersServlet",
  // last-ditch fallback to your JSON servlet (different payload format)
  "https://ihute.rw/Trading/api/delivery/create",
].filter(Boolean) as string[]

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

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/orders/create", candidates: CANDIDATES })
}

export async function POST(req: Request) {
  try {
    const bodyIn = await req.json().catch(() => ({} as any))

    // ---- normalize lines
    const rawItems: LineIn[] = Array.isArray(bodyIn.items) ? bodyIn.items : []
    const items = rawItems.map((it, i) => ({
      name: (it.name ?? it.item_name ?? `Item ${i + 1}`) as string,
      qty: Number(it.qty ?? it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unit: (it.unit ?? it.measurement ?? "") as string,
    }))

    const buyerEmail = String(bodyIn.buyerEmail ?? "")
    const sellerAccount = String(bodyIn.sellerAccount ?? "")

    if (!buyerEmail || !sellerAccount || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "buyerEmail, sellerAccount and items are required" },
        { status: 400 }
      )
    }

    // Build shared fields
    const shared = {
      buyerEmail,
      buyerName: String(bodyIn.buyerName ?? ""),
      buyerPhone: String(bodyIn.buyerPhone ?? ""),
      buyerLocation: String(bodyIn.buyerLocation ?? "NA"),
      sellerAccount,
      sellerName: String(bodyIn.sellerName ?? ""),
      sellerPhone: String(bodyIn.sellerPhone ?? ""),
      paymentName: String(bodyIn.paymentName ?? "PAY_ON_DELIVERY"),
      paymentId: String(bodyIn.paymentId ?? ""),
      reference: String(bodyIn.reference ?? ""),
      currency: String(bodyIn.currency ?? "RWF"),
      items,
    }

    // Try each candidate until one returns valid JSON with ok=true
    let lastErr: { status?: number; raw?: string; url?: string } | undefined

    for (const url of CANDIDATES) {
      try {
        let res: Response
        let text: string
        let json: any

        console.log("[orders/create] Trying:", url)

        if (url.endsWith("/api/delivery/create")) {
          // DeliveryCreateServlet expects JSON body
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...shared,
              // Delivery servlet can compute subtotal, but we can also pass it
              subtotal: items.reduce((s, it) => s + it.qty * it.unitPrice, 0),
            }),
            cache: "no-store",
          })
          text = await res.text()
          try { json = JSON.parse(text) } catch {}
        } else {
          // OrdersServlet expects form + action=createOrder
          const form = new URLSearchParams()
          form.set("action", "createOrder")
          form.set("buyerEmail", shared.buyerEmail)
          if (shared.buyerName) form.set("buyerName", shared.buyerName)
          form.set("buyerPhone", shared.buyerPhone)
          form.set("buyerLocation", shared.buyerLocation)
          form.set("sellerAccount", shared.sellerAccount)
          if (shared.sellerName) form.set("sellerName", shared.sellerName)
          if (shared.sellerPhone) form.set("sellerPhone", shared.sellerPhone)
          form.set("paymentName", shared.paymentName)
          form.set("paymentId", shared.paymentId)
          form.set("reference", shared.reference)
          form.set("currency", shared.currency)
          form.set("items", JSON.stringify(shared.items))

          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
            cache: "no-store",
          })
          text = await res.text()
          try { json = JSON.parse(text) } catch {}
        }

        console.log("[orders/create] <-", url, "status:", res.status)

        // HTML means 404 page or similar
        const looksHtml = /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)

        if (res.ok && json?.ok) {
          const orderId = json?.orderId || `ORD-${Date.now()}`
        return NextResponse.json({ ok: true, orderId, via: url, sellerTel: json?.sellerTel || "" })
        } else {
          lastErr = { status: res.status, raw: looksHtml ? text.slice(0, 200) : text.slice(0, 800), url }
          continue
        }
      } catch (e: any) {
        lastErr = { status: 0, raw: e?.message, url }
        continue
      }
    }

    // Nothing succeeded
    return NextResponse.json(
      {
        ok: false,
        error: "All upstream endpoints failed",
        last: lastErr,
        hint: "Double-check JAVA_ORDERS_URL/JAVA_SERVLET_URL; it should be /Trading/OrdersServlet or /Trading/Kaos/OrdersServlet.",
      },
      { status: 502 }
    )
  } catch (e: any) {
    console.error("[orders/create] fatal:", e?.message)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
