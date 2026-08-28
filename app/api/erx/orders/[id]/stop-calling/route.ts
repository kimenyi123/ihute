import { NextRequest, NextResponse } from "next/server"

import { snapshotOrder, stopCalling } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/erx/orders/{id}/stop-calling — cancels pending RFQs only; received quotes stay. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const order = stopCalling(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, order: snapshotOrder(id) })
}
