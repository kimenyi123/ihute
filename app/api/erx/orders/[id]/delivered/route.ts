import { NextRequest, NextResponse } from "next/server"

import { markDelivered, snapshotOrder } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/erx/orders/{id}/delivered — patient taps "Imiti yangezeho / Nayifashe". */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const order = markDelivered(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, order: snapshotOrder(id) })
}
