import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  }

  try {
    const base = getBackendBase()
    const url = new URL(
      `api/kiosk/orders/${encodeURIComponent(orderId)}/speak`,
      base.endsWith("/") ? base : `${base}/`,
    )

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Failed to request speak" },
        { status: 502 },
      )
    }

    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[kiosk/orders/:id/speak] error", msg)
    return NextResponse.json({ error: "Speak request failed" }, { status: 500 })
  }
}

