import { NextRequest, NextResponse } from "next/server"

import { getOrder, rateOrder, snapshotOrder } from "@/lib/erx/erx-order-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/erx/orders/{id}/rate {pharmacyStars, riderStars} — mandatory
 * before "Byarangiye". Persisted ratings feed pharmacy_metrics (public stars
 * rolling 90d + discipline score); nightly job TODO in the migration.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let body: { pharmacyStars?: number; riderStars?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "ERX_BAD_JSON" }, { status: 400 })
  }

  const pharmacyStars = Math.round(Number(body.pharmacyStars) || 0)
  const riderStars = Math.round(Number(body.riderStars) || 0)
  if (pharmacyStars < 1 || pharmacyStars > 5) {
    return NextResponse.json({ ok: false, code: "ERX_STARS_REQUIRED" }, { status: 400 })
  }

  const existing = getOrder(id)
  if (!existing) {
    return NextResponse.json({ ok: false, code: "ERX_ORDER_NOT_FOUND" }, { status: 404 })
  }
  if (existing.delivery?.mode === "rider" && (riderStars < 1 || riderStars > 5)) {
    return NextResponse.json({ ok: false, code: "ERX_RIDER_STARS_REQUIRED" }, { status: 400 })
  }

  rateOrder(id, pharmacyStars, riderStars)
  // TODO(real): persist into ratings table + refresh pharmacy_metrics on event.
  return NextResponse.json({ ok: true, order: snapshotOrder(id) })
}
