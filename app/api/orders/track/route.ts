import { NextRequest, NextResponse } from "next/server"

const RID_HEADER = "x-request-id"
import { getOrdersUrl, getSellerOrdersUrl } from "@/lib/backend-config"
import { getOrderMeta } from "@/lib/order-client-meta-store"
import {
  getOrCreatePublicTokenForOrderId,
  isPublicTrackingTokenFormat,
  normalizePublicToken,
  resolvePublicTokenToOrderId,
} from "@/lib/order-tracking-token"
import { mapBackendOrderStatusToTrack, type TrackOrderStatus } from "@/lib/order-status-map"

function rid() {
  return Math.random().toString(36).slice(2, 12)
}

function log(requestId: string, ...args: any[]) {
  console.log(`[RID ${requestId}]`, ...args)
}

type OrderStatus = TrackOrderStatus

type StatusHistoryEntry = {
  status: OrderStatus
  timestamp: string
  note?: string
}

function mapPaymentToStatus(orderStatus?: string, paymentStatus?: string): OrderStatus {
  return mapBackendOrderStatusToTrack(orderStatus, paymentStatus)
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
  const createdTime = new Date(createdAt).getTime()

  if (currentStatus === "cancelled") {
    history.push({
      status: "open",
      timestamp: createdAt,
      note: "Order placed",
    })
    history.push({
      status: "cancelled",
      timestamp: updatedAt || createdAt,
      note: "Cancelled or rejected by seller",
    })
    return history
  }

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
    "cancelled": 0,
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
        note = paymentStatus === "paid" ? "Payment received, preparing order" : "Order being prepared"
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

  return history
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(RID_HEADER) || rid()
  log(requestId, "/api/orders/track START")

  try {
    const body = await req.json()
    const rawInput = String(body?.orderId ?? body?.token ?? "").trim()
    const buyerAccount = String(body?.buyerAccount ?? "").trim()

    if (!rawInput) {
      return NextResponse.json(
        { ok: false, error: "Order ID or tracking code is required" },
        { status: 400 }
      )
    }

    let orderId = rawInput
    if (isPublicTrackingTokenFormat(rawInput)) {
      const t = normalizePublicToken(rawInput)
      const resolved = resolvePublicTokenToOrderId(t)
      if (!resolved) {
        log(requestId, `Unknown public token ${t}`)
        return NextResponse.json({ ok: false, error: "Unknown tracking code" }, { status: 404 })
      }
      orderId = resolved
      log(requestId, `Resolved public token ${t} → orderId=${orderId}`)
    }

    log(requestId, `Fetching order details for orderId=${orderId}`)

    // Try getOrderDetails first (if servlet is updated), fallback to buyerOrderDetails
    let data: any = null
    let usingFallback = false

    if (buyerAccount) {
      try {
        const form = new URLSearchParams({
          action: "listBuyerOrderItems",
          buyerAccount: String(buyerAccount),
          orderId: String(orderId),
        }).toString()
        const buyerRes = await fetch(getSellerOrdersUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form,
          cache: "no-store",
        })
        if (buyerRes.ok) {
          const result = await buyerRes.json()
          if (result?.ok && result?.order) {
            const orderData = result.order || {}
            const itemsData = result.items || []
            const buyerData = result.buyer || {}
            data = {
              ...orderData,
              BUYER_ISHYIGA_ACCOUNT: orderData.BUYER_ISHYIGA_ACCOUNT || buyerData.ISHYIGA_ACCOUNT,
              BUYER_OWNER: buyerData.OWNER || orderData.BUYER_OWNER,
              BUYER_PHONE: buyerData.PHONE || orderData.BUYER_PHONE,
              items: itemsData,
            }
            log(requestId, "✅ Using listBuyerOrderItems via SellerOrdersServlet")
          }
        }
      } catch (err) {
        log(requestId, "listBuyerOrderItems failed, continue fallback chain")
      }
    }

    // Fallback chain: OrdersServlet getOrderDetails, then buyerOrderDetails
    if (!data) try {
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

    // Fallback: OrdersServlet buyerOrderDetails (GET — same pattern as getOrderDetails)
    if (!data || usingFallback) {
      const url = new URL(getOrdersUrl())
      url.searchParams.set("action", "buyerOrderDetails")
      url.searchParams.set("orderId", orderId)

      log(requestId, `Fallback: Calling ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
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
        BUYER_ISHYIGA_ACCOUNT: orderData.BUYER_ISHYIGA_ACCOUNT || buyerData.ISHYIGA_ACCOUNT,
        BUYER_OWNER: buyerData.OWNER,
        BUYER_PHONE: buyerData.PHONE || orderData.BUYER_PHONE,
        DELIVERY_LOCATION: orderData.DELIVERY_LOCATION,
        AMOUNT: orderData.AMOUNT,
        PAYMENT_NAME: orderData.PAYMENT_NAME,
        PAYMENT_STATUS: orderData.PAYMENT_STATUS,
        ORDER_STATUS: orderData.ORDER_STATUS,
        REKISIYO_STATUS: orderData.REKISIYO_STATUS,
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

    const createdAt = data.CREATED_AT || data.createdAt || new Date().toISOString()
    const createdTime = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime()
    const estimatedHours = Number(process.env.ORDER_ESTIMATED_DELIVERY_HOURS) || 2
    const estimatedDeliveryAt =
      data.ESTIMATED_DELIVERY_AT != null
        ? new Date(Number(data.ESTIMATED_DELIVERY_AT)).toISOString()
        : new Date(createdTime + estimatedHours * 60 * 60 * 1000).toISOString()
    const driverPhone = data.DRIVER_PHONE ?? data.driver_phone ?? data.DRIVER_TEL ?? undefined

    const rawOrderStatus = (data.ORDER_STATUS || data.order_status || "").toString().trim()
    const rawPaymentStatus = (data.PAYMENT_STATUS || data.payment_status || "").toString().trim()
    /** Show DB values only — no hardcoded friendly labels on ORDER_STATUS / PAYMENT_STATUS. */
    const orderStatusDisplay = rawOrderStatus
    const paymentLegacyDisplay = rawPaymentStatus
    const effectivePaymentStatus = rawPaymentStatus

    const itemsArray = Array.isArray(data.items)
      ? data.items.map((item: any) => ({
          ITEM_CODE: item.ITEM_CODE || item.item_code,
          ITEM_NAME: item.ITEM_NAME || item.name || "Product",
          name: item.ITEM_NAME || item.name || "Product",
          QUANTITY: Number(item.QUANTITY ?? item.qty ?? item.QTY ?? 1),
          qty: Number(item.QUANTITY ?? item.qty ?? item.QTY ?? 1),
          SERVED_QTY: Number(item.CONFIRMED_RECEIVED_QTY ?? item.SERVED_QTY ?? item.served_qty ?? item.servedQty ?? item.received_quantity ?? 0),
          servedQty: Number(item.CONFIRMED_RECEIVED_QTY ?? item.SERVED_QTY ?? item.served_qty ?? item.servedQty ?? item.received_quantity ?? 0),
          REQUEST_PRICE: Number(item.REQUEST_PRICE ?? item.request_price ?? item.REQUESTED_PRICE ?? item.UNIT_PRICE ?? item.unitPrice ?? 0),
          UNITY_PRICE: Number(item.UNITY_PRICE ?? item.unity_price ?? item.SERVED_PRICE ?? item.served_price ?? item.UNIT_PRICE ?? item.unitPrice ?? 0),
          servedAmount: Number(item.SERVED_AMOUNT ?? item.servedAmount ?? item.served_amount ?? item.UNITY_PRICE ?? item.unity_price ?? 0),
          UNIT_PRICE: Number(item.UNIT_PRICE ?? item.unitPrice ?? 0),
          unitPrice: Number(item.UNIT_PRICE ?? item.unitPrice ?? 0),
          UNIT: item.UNIT || item.unit,
          unit: item.UNIT || item.unit,
        }))
      : []
    const totalAmount = Number(data.AMOUNT ?? data.total ?? 0)
    const currency = (data.CURRENCY || "RWF").toString().trim()

    const order = {
      orderId: data.ID_ORDER || orderId,
      sellerName: data.SELLER_NAMES || data.SELLER_OWNER || "Unknown Seller",
      sellerAccount: data.SELLER_ISHYIGA_ACCOUNT || undefined,
      sellerPhone: data.SELLER_PHONE || data.SELLER_TEL || undefined,
      buyerName: data.BUYER_NAME || data.BUYER_OWNER || undefined,
      buyerPhone: data.BUYER_PHONE || data.BUYER_TEL || undefined,
      buyerLocation: data.DELIVERY_LOCATION || data.BUYER_LOCATION || undefined,
      items: itemsArray,
      total: totalAmount,
      paymentMethod: data.PAYMENT_NAME || data.paymentMethod || "Unknown",
      paymentStatus: effectivePaymentStatus,
      status: mappedStatus,
      createdAt,
      updatedAt: data.UPDATED_AT || data.updatedAt || undefined,
      statusHistory: statusHistory,
      estimatedDeliveryAt,
      driverPhone: driverPhone ? String(driverPhone).trim() : undefined,
      // OrderDetails shape for /orders/[orderId] page
      ID_ORDER: data.ID_ORDER || Number(orderId) || orderId,
      SELLER_NAMES: data.SELLER_NAMES || data.SELLER_OWNER || "Unknown Seller",
      SELLER_PHONE: data.SELLER_PHONE || data.SELLER_TEL || undefined,
      SELLER_ISHYIGA_ACCOUNT: data.SELLER_ISHYIGA_ACCOUNT || undefined,
      BUYER_ISHYIGA_ACCOUNT: data.BUYER_ISHYIGA_ACCOUNT || data.buyer_ishyiga_account || undefined,
      BUYER_OWNER: data.BUYER_OWNER || data.BUYER_NAME,
      BUYER_NAME: data.BUYER_NAME || data.BUYER_OWNER,
      BUYER_PHONE: data.BUYER_PHONE || data.BUYER_TEL,
      BUYER_EMAIL: data.BUYER_EMAIL,
      DELIVERY_LOCATION: data.DELIVERY_LOCATION || data.BUYER_LOCATION,
      BUYER_LOCATION: data.BUYER_LOCATION || data.DELIVERY_LOCATION,
      PAYMENT_NAME: data.PAYMENT_NAME || data.paymentMethod || "Unknown",
      PAYMENT_STATUS: paymentLegacyDisplay,
      ORDER_STATUS: orderStatusDisplay,
      REKISIYO_STATUS: data.REKISIYO_STATUS,
      REFERENCE: data.REFERENCE,
      AMOUNT: totalAmount,
      SERVED_AMOUNT: Number(data.SERVED_AMOUNT ?? data.servedAmount ?? data.AMOUNT_SERVED ?? 0),
      CONDITIONS: data.CONDITIONS ?? data.ORDER_NOTE ?? data.orderNote ?? "",
      CURRENCY: currency,
      CREATED_AT: createdAt,
      IS_TABLE_COMMAND: Boolean(data.IS_TABLE_COMMAND ?? data.table_command),
      TABLE_NAME: data.TABLE_NAME || data.table_name,
      TABLE_LOCATION: data.TABLE_LOCATION || data.table_location,
    }

    const clientMeta = getOrderMeta(String(orderId))
    if (clientMeta?.buyerDeliveryAddress) {
      ;(order as Record<string, unknown>).buyerLocation = clientMeta.buyerDeliveryAddress
      ;(order as Record<string, unknown>).DELIVERY_LOCATION = clientMeta.buyerDeliveryAddress
      ;(order as Record<string, unknown>).BUYER_LOCATION = clientMeta.buyerDeliveryAddress
    }
    if (clientMeta?.sellerPaymentAck) {
      ;(order as Record<string, unknown>).sellerPaymentAck = clientMeta.sellerPaymentAck
    }
    if (clientMeta?.updatedAt) {
      ;(order as Record<string, unknown>).clientMetaUpdatedAt = clientMeta.updatedAt
    }

    let publicToken: string | undefined
    try {
      publicToken = getOrCreatePublicTokenForOrderId(String(orderId))
    } catch {
      /* ignore */
    }

    log(requestId, "✅ Order tracking SUCCESS - paymentMethod:", order.paymentMethod, "paymentStatus:", order.PAYMENT_STATUS, "ORDER_STATUS:", order.ORDER_STATUS, "history entries:", statusHistory.length)
    return NextResponse.json({ ok: true, order, publicToken })
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