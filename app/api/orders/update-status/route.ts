// app/api/orders/update-status/route.ts
import { NextResponse } from "next/server"

import { getOrderStatusUrl } from "@/lib/backend-config"

const ORDER_STATUS_URL = getOrderStatusUrl()

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Order status update endpoint",
    method: "POST",
    endpoint: "/api/orders/update-status",
    backendUrl: ORDER_STATUS_URL,
    requiredFields: ["orderId", "status"],
    validStatuses: ["pending", "processing", "invoice", "delivered"],
    example: {
      orderId: 400,
      status: "processing"
    }
  })
}

export async function POST(req: Request) {
  try {
    if (!ORDER_STATUS_URL) {
      return NextResponse.json(
        { ok: false, error: "ORDER_STATUS_URL not configured" },
        { status: 500 }
      )
    }

    const { orderId, status } = await req.json()

    // Validation
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId required" },
        { status: 400 }
      )
    }
    if (!status) {
      return NextResponse.json(
        { ok: false, error: "status required" },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ["pending", "processing", "invoice", "delivered"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    console.log(`[UPDATE-STATUS] Updating order ${orderId} to status: ${status}`)
    console.log(`[UPDATE-STATUS] Backend URL: ${ORDER_STATUS_URL}`)

    const res = await fetch(ORDER_STATUS_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        orderId: Number(orderId), 
        status: String(status) 
      }),
      cache: "no-store",
    })

    console.log(`[UPDATE-STATUS] Response status: ${res.status}`)

    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.ok) {
      const errorMsg = json?.error || `HTTP ${res.status}`
      console.error(`[UPDATE-STATUS] Error: ${errorMsg}`)
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: res.status || 502 }
      )
    }

    console.log(`[UPDATE-STATUS] Success:`, json)
    return NextResponse.json(json)

  } catch (e: any) {
    console.error("[UPDATE-STATUS] Exception:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    )
  }
}