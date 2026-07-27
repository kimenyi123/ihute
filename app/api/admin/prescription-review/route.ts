import { NextRequest, NextResponse } from "next/server"
import { assertStockSyncLogsAccess } from "@/lib/verify-stock-sync-logs-access"
import {
  decidePrescriptionReview,
  listPrescriptionReviewCandidates,
  prescriptionReviewStats,
} from "@/lib/admin-prescription-review"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/prescription-review
 * Query: q, famille, filter=pending|reviewed, page, limit, stats=1
 */
export async function GET(req: NextRequest) {
  const denied = await assertStockSyncLogsAccess(req)
  if (denied) return denied

  try {
    const sp = req.nextUrl.searchParams
    if (sp.get("stats") === "1") {
      const stats = await prescriptionReviewStats()
      return NextResponse.json({ ok: true, stats })
    }
    const result = await listPrescriptionReviewCandidates({
      q: sp.get("q") || undefined,
      famille: sp.get("famille") || undefined,
      filter: (sp.get("filter") as "pending" | "reviewed" | "all_unflagged") || "pending",
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 40) || 40,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load prescription review queue"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/prescription-review
 * Body: { nikiCode, decision: 'rx' | 'otc', note? }
 */
export async function POST(req: NextRequest) {
  const denied = await assertStockSyncLogsAccess(req)
  if (denied) return denied

  try {
    const body = (await req.json().catch(() => ({}))) as {
      nikiCode?: string
      decision?: "rx" | "otc"
      note?: string
    }
    if (body.decision !== "rx" && body.decision !== "otc") {
      return NextResponse.json(
        { ok: false, error: "decision must be 'rx' or 'otc'" },
        { status: 400 },
      )
    }
    const reviewerEmail = req.headers.get("x-admin-email")?.trim() || ""
    const result = await decidePrescriptionReview({
      nikiCode: String(body.nikiCode || ""),
      decision: body.decision,
      note: body.note,
      reviewerEmail,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save review decision"
    const status = /required|must be/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
