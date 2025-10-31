import { NextRequest, NextResponse } from "next/server"

const RID_HEADER = "x-request-id"
const JAVA_ORDERS_URL = process.env.NEXT_PUBLIC_ORDERS_URL || "https://ihute.rw/Trading/Kaos/OrdersServlet"

function rid() {
  return Math.random().toString(36).slice(2, 12)
}

function log(requestId: string, ...args: any[]) {
  console.log(`[RID ${requestId}]`, ...args)
}

type OrderStatus = "pending" | "processing" | "in-transit" | "delivered"

function mapPaymentToStatus(name?: string): OrderStatus {
  const s = (name || "").toLowerCase()
  if (s.includes("delivered") || s.includes("completed")) return "delivered"
  if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit"
  if (s.includes("pending")) return "pending"
  if (s.includes("paid") || s.includes("success") || s.includes("processing")) return "processing"
  return "processing"
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(RID_HEADER) || rid()
  log(requestId, "/api/orders/track START")

  try {
    const body = await req.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Order ID is required" },
        { status: 400 }
      )
    }

    log(requestId, `Fetching order details for orderId=${orderId}`)

    // Call Java backend to get order details
    const url = new URL(JAVA_ORDERS_URL)
    url.searchParams.set("action", "getOrderDetails")
    url.searchParams.set("orderId", orderId)

    log(requestId, `Calling ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    log(requestId, `Backend responded with HTTP ${response.status}`)

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const data = await response.json()
    log(requestId, "Backend response:", JSON.stringify(data).slice(0, 500))

    // Map backend response to frontend format
    const order = {
      orderId: data.ID_ORDER || orderId,
      sellerName: data.SELLER_NAMES || data.SELLER_OWNER || "Unknown Seller",
      sellerPhone: data.SELLER_PHONE || data.SELLER_TEL || undefined,
      buyerName: data.BUYER_NAME || data.BUYER_OWNER || undefined,
      buyerPhone: data.BUYER_PHONE || data.BUYER_TEL || undefined,
      buyerLocation: data.DELIVERY_LOCATION || data.BUYER_LOCATION || undefined,
      items: Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            name: item.ITEM_NAME || item.name || "Product",
            qty: Number(item.QTY || item.qty || 1),
            unitPrice: Number(item.UNIT_PRICE || item.unitPrice || 0),
            unit: item.UNIT || item.unit || undefined,
          }))
        : [],
      total: Number(data.AMOUNT || data.total || 0),
      paymentMethod: data.PAYMENT_NAME || data.paymentMethod || "Unknown",
      status: mapPaymentToStatus(data.PAYMENT_NAME || data.status),
      createdAt: data.CREATED_AT || data.createdAt || new Date().toISOString(),
    }

    log(requestId, "Order tracking SUCCESS")
    return NextResponse.json({ ok: true, order })
  } catch (error: any) {
    log(requestId, "ERROR:", error?.message)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to track order" },
      { status: 500 }
    )
  } finally {
    log(requestId, "/api/orders/track DONE")
  }
}
