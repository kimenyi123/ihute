import { NextResponse } from "next/server"

import { getSellerOrdersUrl } from "@/lib/backend-config"

const JAVA_SELLER_ORDERS_URL = getSellerOrdersUrl()

export async function POST(req: Request) {
  try {
    const { sellerAccount, orderId } = await req.json()
    if (!sellerAccount || !orderId) {
      return NextResponse.json({ ok: false, error: "sellerAccount and orderId required" }, { status: 400 })
    }
    if (!JAVA_SELLER_ORDERS_URL) {
      return NextResponse.json({ ok: false, error: "JAVA_SELLER_ORDERS_URL not configured" }, { status: 500 })
    }

    const params = new URLSearchParams()
    params.set("action", "listSellerOrderItems")
    params.set("sellerAccount", String(sellerAccount))
    params.set("orderId", String(orderId))

    const res = await fetch(JAVA_SELLER_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: "Bad JSON from servlet", raw: text.slice(0, 1000) }, { status: 502 })
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: json?.error || `Failed to load` }, { status: 502 })
    }

    // Transform the Java response to match frontend expectations
    // Java returns: { ok: true, orders: [...] } or { ok: true, order: {...}, items: [...] }
    let transformedResponse = json
    
    // If Java returns orders array, find the specific order and transform it
    if (json.orders && Array.isArray(json.orders)) {
      const orderData = json.orders.find((o: any) => o.ID_ORDER == orderId)
      if (orderData) {
        transformedResponse = {
          ok: true,
          order: {
            ID_ORDER: orderData.ID_ORDER,
            SELLER_ISHYIGA_ACCOUNT: orderData.SELLER_ISHYIGA_ACCOUNT,
            SELLER_NAMES: orderData.SELLER_NAMES,
            DELIVERY_LOCATION: orderData.DELIVERY_LOCATION,
            PAYMENT_NAME: orderData.PAYMENT_NAME || "PAY_ON_DELIVERY",
            ORDER_STATUS: orderData.STATUS,
            AMOUNT: orderData.AMOUNT,
            CURRENCY: orderData.CURRENCY || "RWF",
            CREATED_AT: orderData.CREATED_AT
          },
          buyer: {
            NAMES: orderData.BUYER_NAMES,
            PHONE: orderData.BUYER_PHONE,
            ISHYIGA_ACCOUNT: orderData.BUYER_ISHYIGA_ACCOUNT
          },
          items: [{
            ITEM_NAME: orderData.ITEM_NAME,
            ITEM_CODE: orderData.ITEM_CODE || orderData.ID_ORDER,
            quantity: orderData.ITEM_QTY,
            unit: orderData.UNIT || "piece",
            UNITY_PRICE: orderData.UNIT_PRICE || (orderData.AMOUNT / orderData.ITEM_QTY)
          }]
        }
      } else {
        return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
      }
    }

    return NextResponse.json(transformedResponse)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 400 })
  }
}
