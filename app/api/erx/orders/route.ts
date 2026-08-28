import { NextRequest, NextResponse } from "next/server"

import { ERX_MOCK_ENABLED } from "@/lib/erx/erx-market-flags"
import { createRfqOrder, registerPosInserts, snapshotOrder } from "@/lib/erx/erx-order-store"
import { pushRfqToPos } from "@/lib/erx/erx-pos-channel"
import { insertErxTracking } from "@/lib/erx/erx-tracking"
import type { ErxCandidatePharmacy, ErxRfqItem } from "@/lib/erx/erx-market-types"
import { getClientIp } from "@/lib/ip-rate-limit"

function dedupePharmacies(pharmacies: ErxCandidatePharmacy[]): ErxCandidatePharmacy[] {
  const seen = new Set<string>()
  const out: ErxCandidatePharmacy[] = []
  for (const p of pharmacies) {
    const id = p.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(p)
  }
  return out
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/erx/orders — RFQ: insertTransaction on post_orders for each pharmacy
 * (INFO_1=ERX, REFERENCE=eRx code, MoH patient name/phone, MSG_UBITANZE, ITEMSLINE).
 */
export async function POST(req: NextRequest) {
  const requestedAt = new Date()
  let body: {
    erxCode?: string
    items?: ErxRfqItem[]
    pharmacies?: ErxCandidatePharmacy[]
    patientName?: string
    patientPhone?: string
    msgUbitanze?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_RFQ_INVALID" }, { status: 400 })
  }

  const erxCode = (body.erxCode || "").trim()
  const items = Array.isArray(body.items) ? body.items : []
  const pharmacies = dedupePharmacies(Array.isArray(body.pharmacies) ? body.pharmacies : [])
  if (!erxCode || !items.length || !pharmacies.length) {
    return NextResponse.json({ ok: false, code: "ERX_RFQ_INVALID" }, { status: 400 })
  }

  const order = createRfqOrder({ erxCode, items, pharmacies, mock: ERX_MOCK_ENABLED })

  const patientName = (body.patientName || "").trim()
  const patientPhone = (body.patientPhone || "").trim()

  const posInserts = await pushRfqToPos({
    orderId: order.id,
    erxCode,
    items,
    pharmacies: pharmacies.map((p) => ({ id: p.id, name: p.name })),
    patientName: patientName || undefined,
    patientPhone: patientPhone || undefined,
    msgUbitanze: body.msgUbitanze || "KEY USED",
  })

  registerPosInserts(
    order.id,
    posInserts.map((r) => ({
      pharmacyId: r.pharmacyId,
      transactionId: r.transactionId,
      ok: r.ok,
    })),
  )

  const posOk = posInserts.filter((r) => r.ok).length
  const posSummary = `${posOk}/${posInserts.length} pharmacies inserted on post_orders`

  void insertErxTracking({
    eventType: "RFQ",
    erxCode,
    status: posOk > 0 ? "SUCCESS" : "FAIL",
    failCode: posOk > 0 ? null : "ERX_POS_INSERT_FAILED",
    requestedAt,
    respondedAt: new Date(),
    patientDisplayName: patientName || null,
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
