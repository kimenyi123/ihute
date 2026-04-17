import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { lane?: "bar" | "kitchen" }

  try {
    const base = getBackendBase()
    const url = new URL(
      `api/kiosk/orders/${encodeURIComponent(orderId)}/pickup-done`,
      base.endsWith("/") ? base : `${base}/`,
    )

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body.lane ? { lane: body.lane } : {}),
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Failed to mark pickup done" },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, orderId })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[kiosk/orders/:id/pickup-done] error", msg)
    return NextResponse.json(
      { error: "Pickup-done request failed" },
      { status: 500 },
    )
  }
}
