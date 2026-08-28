import { NextRequest, NextResponse } from "next/server"

import { snapshotOrder } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/erx/orders/{id}/delivery-offers — Seller Central rider offers
 * (type moto|bike, fee, eta), rendered by the pay screen as they arrive.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const order = snapshotOrder(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, offers: order.riderOffers })
}
