import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"
import type { KioskOrderPayload } from "@/src/modules/self-order/types"

function mapPaymentToOrdersPaymentName(method: KioskOrderPayload["payment_method"]): string {
  switch (method) {
    case "CASH":
      return "PAY_ON_DELIVERY"
    case "MOMO":
      return "MOMO"
    case "CARD":
      return "CARD"
    default:
      return "PAY_ON_DELIVERY"
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as KioskOrderPayload

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "No items in kiosk order" },
        { status: 400 },
      )
    }

    // For kiosk we assume a single venue; use the first line's seller_account
    const first = body.items[0]
    const sellerAccount = String(first.seller_account || "").trim()

    if (!sellerAccount) {
      return NextResponse.json(
        { error: "Missing seller account for kiosk order" },
        { status: 400 },
      )
    }

    const paymentName = mapPaymentToOrdersPaymentName(body.payment_method)

    const items = body.items.map((it, idx) => ({
      itemCode: it.item_code,
      itemName: it.item_name || `Item ${idx + 1}`,
      qty: it.quantity,
      unit: it.unit,
      unitPrice: it.unit_price,
      lineTotal: it.line_total,
    }))

    const form = new URLSearchParams()
    form.set("action", "createKioskOrder")
    form.set("sellerAccount", sellerAccount)
    form.set("items", JSON.stringify(items))
    if (body.table_number) form.set("tableNumber", body.table_number)
    if (body.customer_name) form.set("customerName", body.customer_name)
    form.set("kioskCategory", body.kiosk_category)
    form.set("paymentName", paymentName)
    form.set("currency", body.currency || "RWF")

    const ordersUrl = getOrdersUrl() // Points to Kaos/OrdersServlet

    const resp = await fetch(ordersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      cache: "no-store",
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "Failed to create kiosk order" },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      orderId: data.orderId ?? data.order_id,
      orderNumber: data.orderNumber ?? data.order_number,
      status: "waiting",
    })
  } catch (e: any) {
    console.error("[kiosk/order] error", e?.message || e)
    return NextResponse.json(
      { error: "Order request failed" },
      { status: 500 },
    )
  }
}
