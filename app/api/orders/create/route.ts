import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Primary candidates (your web.xml maps both)
const CANDIDATES = [
  "https://ihute.rw/Trading/OrdersServlet",
  "https://ihute.rw/Trading/Kaos/OrdersServlet",
  process.env.JAVA_ORDERS_URL,
  process.env.JAVA_SERVLET_URL,
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
  return NextResponse.json({
    ok: true,
    route: "/api/orders/create",
    candidates: CANDIDATES,
    env: {
      JAVA_ORDERS_URL: process.env.JAVA_ORDERS_URL || "not set",
      JAVA_SERVLET_URL: process.env.JAVA_SERVLET_URL || "not set"
    }
  })
}

export async function POST(req: Request) {
  try {
    const bodyIn = await req.json().catch(() => ({} as any))

    console.log("🚀 === ORDER CREATE DEBUG ===")
    console.log("🚀 CANDIDATES:", CANDIDATES)
    console.log("🚀 ENV VARS:", {
      JAVA_ORDERS_URL: process.env.JAVA_ORDERS_URL,
      JAVA_SERVLET_URL: process.env.JAVA_SERVLET_URL
    })

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

    // ✅ VALIDATE PAYMENT METHOD
    let paymentName = String(bodyIn.paymentName ?? "PAY_ON_DELIVERY").toUpperCase()
    const validPaymentMethods = [
      "PAY_ON_DELIVERY",
      "PAID_MTN_MOMO",
      "PAID_CARD",
      "MTN_MOMO",
      "MOMO",
      "CARD"
    ]

    if (!validPaymentMethods.includes(paymentName)) {
      return NextResponse.json(
        { ok: false, error: `Invalid payment method: ${paymentName}` },
        { status: 400 }
      )
    }

    // ✅ GENERATE PAYMENT ID IF NOT PROVIDED
    let paymentId = String(bodyIn.paymentId ?? "")
    if (!paymentId) {
      if (paymentName.includes("MOMO")) {
        paymentId = `MOMO_${Date.now()}`
      } else if (paymentName.includes("CARD")) {
        paymentId = `CARD_${Date.now()}`
      } else {
        paymentId = `COD_${Date.now()}`
      }
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
      paymentName,
      paymentId,
      reference: String(bodyIn.reference ?? ""),
      currency: String(bodyIn.currency ?? "RWF"),
      items,
      // Table command fields
      isTableCommand: Boolean(bodyIn.isTableCommand),
      tableName: String(bodyIn.tableName ?? ""),
      tableLocation: String(bodyIn.tableLocation ?? ""),
    }

    console.log("[orders/create] Creating order with payment:", {
      paymentName: shared.paymentName,
      paymentId: shared.paymentId,
      buyerEmail: shared.buyerEmail,
      sellerAccount: shared.sellerAccount,
      itemsCount: shared.items.length,
      isTableCommand: shared.isTableCommand,
      tableName: shared.tableName || "N/A"
    })

    // Try each candidate until one returns valid JSON
    let lastErr: { status?: number; raw?: string; url?: string } | undefined
    let lastBackendError: string | undefined

    for (const url of CANDIDATES) {
      try {
        let res: Response
        let text: string
        let json: any

        console.log("[orders/create] 🎯 Trying:", url)

        if (url.endsWith("/api/delivery/create")) {
          // DeliveryCreateServlet expects JSON body
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...shared,
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

          if (shared.isTableCommand) {
            form.set("isTableCommand", "true")
            form.set("tableName", shared.tableName)
            form.set("tableLocation", shared.tableLocation)
          }

          console.log("[orders/create] 📤 Sending form data:", {
            paymentName: shared.paymentName,
            paymentId: shared.paymentId,
            action: "createOrder",
            url: url
          })

          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
            cache: "no-store",
          })
          text = await res.text()
          try { json = JSON.parse(text) } catch {}
        }

        console.log("[orders/create] 📥 Response from", url)
        console.log("  Status:", res.status)
        console.log("  Body:", text.slice(0, 300))

        const looksHtml = /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)

        // Check if we got valid JSON response
        if (res.ok && json) {
          // Success case: backend says ok: true
          if (json.ok === true) {
            const orderId = json?.orderId || `ORD-${Date.now()}`
            console.log("[orders/create] ✅ Order created successfully:", {
              orderId,
              paymentName: shared.paymentName,
              via: url
            })
            return NextResponse.json({
              ok: true,
              orderId,
              via: url,
              sellerTel: json?.sellerTel || "",
              paymentName: shared.paymentName
            })
          }

          // Business logic error: backend says ok: false
          if (json.ok === false) {
            const errorMsg = json.error || "Order creation failed"
            console.log("[orders/create] ⚠️ Backend returned error:", errorMsg)
            lastBackendError = errorMsg

            // Return immediately with the backend's error message
            return NextResponse.json({
              ok: false,
              error: errorMsg,
              details: json
            }, { status: 400 })
          }
        }

        // Invalid response - try next endpoint
        console.log("[orders/create] ❌ Invalid response from", url)
        lastErr = {
          status: res.status,
          raw: looksHtml ? text.slice(0, 200) : text.slice(0, 800),
          url
        }
        continue

      } catch (e: any) {
        console.log("[orders/create] ❌ Exception:", e?.message)
        lastErr = { status: 0, raw: e?.message, url }
        continue
      }
    }

    // Nothing succeeded - all endpoints failed to connect
    console.log("[orders/create] ❌ All endpoints failed. Last error:", lastErr)

    // If we got a backend error, use that
    if (lastBackendError) {
      return NextResponse.json({
        ok: false,
        error: lastBackendError
      }, { status: 400 })
    }

    // Otherwise, connection failed
    return NextResponse.json(
      {
        ok: false,
        error: "Could not connect to order processing service",
        last: lastErr,
        candidates: CANDIDATES,
        hint: "Check if Java backend is running. Verify JAVA_ORDERS_URL and JAVA_SERVLET_URL in .env.local",
      },
      { status: 502 }
    )
  } catch (e: any) {
    console.error("[orders/create] 💥 Fatal error:", e?.message)
    console.error(e?.stack)
    return NextResponse.json({
      ok: false,
      error: e?.message || "unknown error"
    }, { status: 500 })
  }
}