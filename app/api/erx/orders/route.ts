import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { createRfqOrder, snapshotOrder } from "@/lib/erx/erx-order-store"
import { pushRfqToPos } from "@/lib/erx/erx-pos-channel"
import type { ErxCandidatePharmacy, ErxRfqItem } from "@/lib/erx/erx-market-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/erx/orders — creates the RFQ (type=ERX_RFQ) and pushes it to ALL
 * selected pharmacies on the existing ihute pending-orders channel that
 * Ishyiga POS polls. Pharmacy confirm/decline/partial from POS becomes the
 * quote (mock simulator answers when NEXT_PUBLIC_ERX_MOCK=1).
 */
export async function POST(req: NextRequest) {
  let body: {
    erxCode?: string
    items?: ErxRfqItem[]
    pharmacies?: ErxCandidatePharmacy[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_BAD_JSON" }, { status: 400 })
  }

  const erxCode = (body.erxCode || "").trim()
  const items = Array.isArray(body.items) ? body.items : []
  const pharmacies = Array.isArray(body.pharmacies) ? body.pharmacies : []
  if (!erxCode || !items.length || !pharmacies.length) {
    return NextResponse.json({ ok: false, code: "ERX_RFQ_INVALID" }, { status: 400 })
  }

  const order = createRfqOrder({ erxCode, items, pharmacies, mock: ERX_MOCK_ENABLED })

  // Fire-and-forget: POS panel insertion must never block the patient flow.
  void pushRfqToPos({
    orderId: order.id,
    erxCode,
    items,
    pharmacyIds: pharmacies.map((p) => p.id),
  })

  return NextResponse.json({ ok: true, order: snapshotOrder(order.id) })
}
