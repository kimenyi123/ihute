import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"
import type { KioskOrderStatus } from "@/src/modules/self-order/types"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json(
      { error: "orderId is required" },
      { status: 400 },
    )
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      status?: KioskOrderStatus
      lane?: "bar" | "kitchen"
    }
    if (!body.status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      )
    }

    const base = getBackendBase()
    const url = new URL(`${base}/api/kiosk/orders/${encodeURIComponent(orderId)}/status`)

    // Pass the kiosk status directly — Java's mapKioskStatusToKaos() converts it
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        body.lane ? { status: body.status, lane: body.lane } : { status: body.status },
      ),
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to update order status" },
        { status: 502 },
      )
    }

    return NextResponse.json({
      orderId,
      status: body.status,
    })
  } catch (e: any) {
    console.error("[kiosk/orders/:id/status] error", e?.message || e)
    return NextResponse.json(
      { error: "Status update request failed" },
      { status: 500 },
    )
  }
}

