import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { ERX_SYNC_POLL_SEC } from "@/lib/erx/erx-pos-sync"
import { snapshotOrder, syncOrderFromPos } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/erx/orders/{id}/quotes — polled every ~10s.
 * Real mode: pulls POS answers from order_transaction_list
 * (CONFIRMED_RECEIVED_QTY, UNITY_PRICE) before returning snapshot.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  if (!ERX_MOCK_ENABLED) {
    try {
      await syncOrderFromPos(id)
    } catch (e) {
      console.warn("[erx/quotes] POS sync failed:", e instanceof Error ? e.message : e)
    }
  }

  const order = snapshotOrder(id)
  if (!order) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }

  if (order.sync) {
    order.sync.nextPollSec = ERX_SYNC_POLL_SEC
  }

  return NextResponse.json({ ok: true, order })
}
