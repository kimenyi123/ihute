import { NextRequest, NextResponse } from "next/server"

const RID_HEADER = "x-request-id"
import { getOrdersUrl } from "@/lib/backend-config"

function rid() {
  return Math.random().toString(36).slice(2, 12)
}

function log(requestId: string, ...args: any[]) {
  console.log(`[RID ${requestId}]`, ...args)
}

type OrderStatus = "open" | "pending" | "processing" | "invoice" | "in-transit" | "delivered"

type StatusHistoryEntry = {
  status: OrderStatus
  timestamp: string
  note?: string
}

function mapPaymentToStatus(orderStatus?: string, paymentStatus?: string): OrderStatus {
  // Priority 1: Check ORDER_STATUS if it exists
  if (orderStatus) {
    const s = orderStatus.toLowerCase()
    if (s.includes("delivered") || s.includes("completed")) return "delivered"
    if (s.includes("transit") || s.includes("shipped") || s.includes("out")) return "in-transit"
    if (s.includes("invoice")) return "invoice"
    if (s.includes("processing") || s.includes("preparing")) return "processing"
    if (s.includes("open")) return "open"
  }

  // Priority 2: Check PAYMENT_STATUS
  if (paymentStatus) {
    const p = paymentStatus.toLowerCase()
    if (p === "paid" || p === "success") return "processing"
    if (p === "pending") return "pending"
    if (p === "failed") return "open"
  }

  // Default to open
  return "open"
}

/**
 * Build status history based on available data
 * This creates a synthetic history if the backend doesn't provide one
 */
function buildStatusHistory(
  currentStatus: OrderStatus,
  createdAt: string,
  orderStatus?: string,
  paymentStatus?: string,
  updatedAt?: string
): StatusHistoryEntry[] {
  const history: StatusHistoryEntry[] = []
  const now = new Date().toISOString()
  const createdTime = new Date(createdAt).getTime()

  // Always add the "open" status when order was created
  history.push({
    status: "open",
    timestamp: createdAt,
    note: "Order placed"
  })

  // Map of status progression with estimated time intervals (in milliseconds)
  const statusProgression: Record<OrderStatus, number> = {
    "open": 0,
    "pending": 0,
    "processing": 1000 * 60 * 30, // 30 minutes after open
    "invoice": 1000 * 60 * 60 * 2, // 2 hours after open
    "in-transit": 1000 * 60 * 60 * 24, // 1 day after open
    "delivered": 1000 * 60 * 60 * 48, // 2 days after open
  }

  const statusOrder: OrderStatus[] = ["open", "processing", "invoice", "in-transit", "delivered"]
  const currentIndex = statusOrder.indexOf(currentStatus)

  // Add intermediate statuses with estimated timestamps
  for (let i = 1; i <= currentIndex; i++) {
    const status = statusOrder[i]
    const estimatedTime = createdTime + statusProgression[status]
    const timestamp = updatedAt && i === currentIndex ? updatedAt : new Date(estimatedTime).toISOString()

    let note = ""
    switch (status) {
      case "processing":
        note = paymentStatus === "paid" ? "Payment confirmed, preparing order" : "Order being prepared"
        break
      case "invoice":
        note = "Invoice generated"
        break
      case "in-transit":
        note = "Out for delivery"
        break
      case "delivered":
        note = "Successfully delivered"
        break
    }

    history.push({
      status,
      timestamp,
      note
    })
  }

  // If we have explicit ORDER_STATUS that differs from our mapped status, add it
  if (orderStatus && orderStatus !== currentStatus) {
    history.push({
      status: currentStatus,
      timestamp: updatedAt || now,
      note: `Status: ${orderStatus}`
    })
  }

  return history
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

    // Try getOrderDetails first (if servlet is updated), fallback to buyerOrderDetails
    let data: any = null
    let usingFallback = false

    try {
      // Try new endpoint first
      const url = new URL(getOrdersUrl())
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

      if (response.ok) {
        const result = await response.json()
        log(requestId, "getOrderDetails response:", JSON.stringify(result).slice(0, 1000))
        if (result.ok && result.order) {
          data = result.order
          log(requestId, "✅ Using getOrderDetails - PAYMENT_NAME:", data.PAYMENT_NAME, "PAYMENT_STATUS:", data.PAYMENT_STATUS, "ORDER_STATUS:", data.ORDER_STATUS)
        }
      }
    } catch (err) {
      log(requestId, "getOrderDetails failed, trying buyerOrderDetails fallback")
      usingFallback = true
    }

    // Fallback to existing buyerOrderDetails endpoint
    if (!data || usingFallback) {
      const url = new URL(getOrdersUrl())
      url.searchParams.set("action", "buyerOrderDetails")
      url.searchParams.set("orderId", orderId)

      log(requestId, `Fallback: Calling ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`)
      }

      const result = await response.json()
      log(requestId, "Backend response:", JSON.stringify(result).slice(0, 500))

      if (!result.ok) {
        throw new Error(result.error || "Failed to fetch order details")
      }

      // Use buyerOrderDetails format
      const orderData = result.order || {}
      const itemsData = result.items || []
      const sellerData = result.seller || {}
      const buyerData = result.buyer || {}

      log(requestId, "Using fallback - orderData.PAYMENT_NAME:", orderData.PAYMENT_NAME, "ORDER_STATUS:", orderData.ORDER_STATUS)

      data = {
        ID_ORDER: orderData.ID_ORDER,
        SELLER_NAMES: orderData.SELLER_NAMES || sellerData.OWNER,
        SELLER_ISHYIGA_ACCOUNT: orderData.SELLER_ISHYIGA_ACCOUNT || sellerData.ISHYIGA_ACCOUNT,
        SELLER_PHONE: sellerData.TEL,
        BUYER_OWNER: buyerData.OWNER,
        BUYER_PHONE: buyerData.PHONE || orderData.BUYER_PHONE,
        DELIVERY_LOCATION: orderData.DELIVERY_LOCATION,
        AMOUNT: orderData.AMOUNT,
        PAYMENT_NAME: orderData.PAYMENT_NAME,
        PAYMENT_STATUS: orderData.PAYMENT_STATUS,
        ORDER_STATUS: orderData.ORDER_STATUS,
        CREATED_AT: orderData.CREATED_AT,
        UPDATED_AT: orderData.UPDATED_AT,
        items: itemsData.map((item: any) => ({
          ITEM_NAME: item.ITEM_NAME,
          QTY: item.QUANTITY,
          UNIT_PRICE: item.UNIT_PRICE,
          UNIT: item.UNIT,
        })),
      }

      log(requestId, "Mapped data - PAYMENT_NAME:", data.PAYMENT_NAME, "PAYMENT_STATUS:", data.PAYMENT_STATUS, "ORDER_STATUS:", data.ORDER_STATUS)
    }

    // Map backend response to frontend format
    log(requestId, "Final mapping - PAYMENT_NAME:", data.PAYMENT_NAME, "PAYMENT_STATUS:", data.PAYMENT_STATUS, "ORDER_STATUS:", data.ORDER_STATUS)

    const mappedStatus = mapPaymentToStatus(data.ORDER_STATUS, data.PAYMENT_STATUS)

    // Build status history
    const statusHistory = buildStatusHistory(
      mappedStatus,
      data.CREATED_AT || new Date().toISOString(),
      data.ORDER_STATUS,
      data.PAYMENT_STATUS,
      data.UPDATED_AT
    )

    log(requestId, "Generated status history with", statusHistory.length, "entries")

    const order = {
      orderId: data.ID_ORDER || orderId,
      sellerName: data.SELLER_NAMES || data.SELLER_OWNER || "Unknown Seller",
      sellerAccount: data.SELLER_ISHYIGA_ACCOUNT || undefined,
      sellerPhone: data.SELLER_PHONE || data.SELLER_TEL || undefined,
      buyerName: data.BUYER_NAME || data.BUYER_OWNER || undefined,
      buyerPhone: data.BUYER_PHONE || data.BUYER_TEL || undefined,
      buyerLocation: data.DELIVERY_LOCATION || data.BUYER_LOCATION || undefined,
      items: Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            name: item.ITEM_NAME || item.name || "Product",
            qty: Number(item.QTY || item.qty || item.QUANTITY || 1),
            unitPrice: Number(item.UNIT_PRICE || item.unitPrice || 0),
            unit: item.UNIT || item.unit || undefined,
          }))
        : [],
      total: Number(data.AMOUNT || data.total || 0),
      paymentMethod: data.PAYMENT_NAME || data.paymentMethod || "Unknown",
      paymentStatus: data.PAYMENT_STATUS || undefined,
      status: mappedStatus,
      createdAt: data.CREATED_AT || data.createdAt || new Date().toISOString(),
      updatedAt: data.UPDATED_AT || data.updatedAt || undefined,
      statusHistory: statusHistory,
    }

    log(requestId, "✅ Order tracking SUCCESS - paymentMethod:", order.paymentMethod, "paymentStatus:", order.paymentStatus, "status:", order.status, "history entries:", statusHistory.length)
    return NextResponse.json({ ok: true, order })
  } catch (error: any) {
    log(requestId, "❌ ERROR:", error?.message)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to track order" },
      { status: 500 }
    )
  } finally {
    log(requestId, "/api/orders/track DONE")
  }
}