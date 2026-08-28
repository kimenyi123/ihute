import { NextRequest, NextResponse } from "next/server"

import { snapshotOrder } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/erx/orders/{id}/quotes — polled by the patient UI (steps 4–5).
 * Returns the full order snapshot: quote statuses
 * (CALLING|FULL|PARTIAL|DECLINED|STOPPED), rider offers, payment and tracking.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const order = snapshotOrder(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, order })
}
