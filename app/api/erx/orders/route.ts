import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { createRfqOrder, snapshotOrder } from "@/lib/erx/erx-order-store"
import { pushRfqToPos } from "@/lib/erx/erx-pos-channel"
import { insertErxTracking } from "@/lib/erx/erx-tracking"
import type { ErxCandidatePharmacy, ErxRfqItem } from "@/lib/erx/erx-market-types"
import { getClientIp } from "@/lib/ip-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/erx/orders — RFQ: insertTransaction on post_orders for each pharmacy
 * (INFO_1=ERX, INFO_2=eRx code, MSG_UBITANZE, ITEMSLINE). Pay is a later step.
 */
export async function POST(req: NextRequest) {
  const requestedAt = new Date()
  let body: {
    erxCode?: string
    items?: ErxRfqItem[]
    pharmacies?: ErxCandidatePharmacy[]
    msgUbitanze?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_RFQ_INVALID" }, { status: 400 })
  }

  const erxCode = (body.erxCode || "").trim()
  const items = Array.isArray(body.items) ? body.items : []
  const pharmacies = Array.isArray(body.pharmacies) ? body.pharmacies : []
  if (!erxCode || !items.length || !pharmacies.length) {
    return NextResponse.json({ ok: false, code: "ERX_RFQ_INVALID" }, { status: 400 })
  }

  const order = createRfqOrder({ erxCode, items, pharmacies, mock: ERX_MOCK_ENABLED })

  const posInserts = await pushRfqToPos({
    orderId: order.id,
    erxCode,
    items,
    pharmacies: pharmacies.map((p) => ({ id: p.id, name: p.name })),
    msgUbitanze: body.msgUbitanze || "KEY USED",
  })

  const posOk = posInserts.filter((r) => r.ok).length
  const posSummary = `${posOk}/${posInserts.length} pharmacies inserted on post_orders`

  void insertErxTracking({
    eventType: "RFQ",
    erxCode,
    status: posOk > 0 ? "SUCCESS" : "FAIL",
    failCode: posOk > 0 ? null : "ERX_POS_INSERT_FAILED",
    requestedAt,
    respondedAt: new Date(),
    drugCount: items.length,
    drugsJson: items,
    orderId: order.id,
    pharmaciesRequested: pharmacies.map((p) => ({ id: p.id, name: p.name })),
    pharmaciesInserted: posOk,
    posSummary,
    serviceStage: "RFQ",
    clientIp: getClientIp(req),
    userAgent: req.headers.get("user-agent") || "",
    meta: { posInserts },
  })

  return NextResponse.json({
    ok: true,
    order: snapshotOrder(order.id),
    posInserts,
    posSummary,
  })
}
