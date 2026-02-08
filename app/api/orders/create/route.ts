import { NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type LineIn = {
  name?: string
  item_name?: string
  itemCode?: string
  qty?: number | string
  quantity?: number | string
  unitPrice?: number | string
  price?: number | string
  unit?: string
  measurement?: string
}

/* =========================
   GET – health check
========================= */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/orders/create",
    ordersUrl: getOrdersUrl(),
  })
}

/* =========================
   POST – create order
   Backend contract: do NOT validate "item exists" (e.g. lookup by itemCode).
   Frontend only allows adding to cart items that exist (have quantity).
========================= */
export async function POST(req: Request) {
  try {
    const bodyIn = await req.json().catch(() => ({} as any))

    /* -------- normalize items -------- */
    const rawItems: LineIn[] = Array.isArray(bodyIn.items) ? bodyIn.items : []
    const items = rawItems.map((it, i) => ({
      name: String(it.name ?? it.item_name ?? `Item ${i + 1}`),
      itemCode: String(it.itemCode ?? "").trim() || undefined,
      qty: Number(it.qty ?? it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unit: String(it.unit ?? it.measurement ?? ""),
    }))

    console.log("[orders/create] Request items (NIKI_CODE in logs only):", items.map((it) => ({ name: it.name, qty: it.qty, NIKI_CODE: it.itemCode, unitPrice: it.unitPrice })))

    const buyerEmail = String(bodyIn.buyerEmail ?? "")
    const sellerAccount = String(bodyIn.sellerAccount ?? "")

    if (!buyerEmail || !sellerAccount || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "buyerEmail, sellerAccount and items are required" },
        { status: 400 }
      )
    }

    /* -------- payment validation -------- */
    let paymentName = String(bodyIn.paymentName ?? "PAY_ON_DELIVERY").toUpperCase()
    const validPaymentMethods = [
      "PAY_ON_DELIVERY",
      "PAID_MTN_MOMO",
      "PAID_CARD",
      "MTN_MOMO",
      "MOMO",
      "CARD",
    ]

    if (!validPaymentMethods.includes(paymentName)) {
      return NextResponse.json(
        { ok: false, error: `Invalid payment method: ${paymentName}` },
        { status: 400 }
      )
    }

    let paymentId = String(bodyIn.paymentId ?? "")
    if (!paymentId) {
      if (paymentName.includes("MOMO")) paymentId = `MOMO_${Date.now()}`
      else if (paymentName.includes("CARD")) paymentId = `CARD_${Date.now()}`
      else paymentId = `COD_${Date.now()}`
    }

    /* -------- shared payload -------- */
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
      isTableCommand: Boolean(bodyIn.isTableCommand),
      tableName: String(bodyIn.tableName ?? ""),
      tableLocation: String(bodyIn.tableLocation ?? ""),
    }

    let lastErr:
      | { status?: number; raw?: string; url?: string }
      | undefined
    let lastBackendError: string | undefined
    const url = getOrdersUrl()

    try {
        let res: Response
        let text = ""
        let json: any = null

        // JSON backend
        if (url.endsWith("/api/delivery/create")) {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...shared,
              subtotal: items.reduce(
                (s, it) => s + it.qty * it.unitPrice,
                0
              ),
            }),
            cache: "no-store",
          })
        }
        // Form backend
        else {
          const form = new URLSearchParams()
          form.set("action", "createOrder")
          form.set("buyerEmail", shared.buyerEmail)
          form.set("buyerPhone", shared.buyerPhone)
          form.set("buyerLocation", shared.buyerLocation)
          form.set("sellerAccount", shared.sellerAccount)
          form.set("paymentName", shared.paymentName)
          form.set("paymentId", shared.paymentId)
          form.set("reference", shared.reference)
          form.set("currency", shared.currency)
          form.set("items", JSON.stringify(shared.items))

          if (shared.buyerName) form.set("buyerName", shared.buyerName)
          if (shared.sellerName) form.set("sellerName", shared.sellerName)
          if (shared.sellerPhone) form.set("sellerPhone", shared.sellerPhone)

          if (shared.isTableCommand) {
            form.set("isTableCommand", "true")
            form.set("tableName", shared.tableName)
            form.set("tableLocation", shared.tableLocation)
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body: form.toString(),
            signal: controller.signal,
            cache: "no-store",
          })

          clearTimeout(timeoutId)
        }

        text = await res.text()
        try {
          json = JSON.parse(text)
        } catch {}

        if (res.ok && json?.ok === true) {
          return NextResponse.json({
            ok: true,
            orderId: json.orderId ?? `ORD-${Date.now()}`,
            via: url,
            sellerTel: json?.sellerTel ?? "",
            paymentName: shared.paymentName,
          })
        }

        if (json?.ok === false) {
          lastBackendError = json.error || "Backend error"
          return NextResponse.json(
            { ok: false, error: lastBackendError, details: json },
            { status: 400 }
          )
        }

        lastErr = {
          status: res.status,
          raw: text.slice(0, 300),
          url,
        }
      } catch (e: any) {
      console.log("[orders/create] ❌ Exception:", e?.message)
      lastErr = { status: 0, raw: e?.message, url }
    }

    /* -------- backend failed -------- */
    return NextResponse.json(
      {
        ok: false,
        error:
          lastBackendError ||
          "Could not connect to order processing service",
        last: lastErr,
        ordersUrl: url,
        hint: "Check Java backend. Set JAVA_ORDERS_URL or NEXT_PUBLIC_API_URL in .env / .env.local",
      },
      { status: 502 }
    )
  } catch (e: any) {
    console.error("[orders/create] Fatal error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
