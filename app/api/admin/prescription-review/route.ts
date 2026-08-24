import { NextRequest, NextResponse } from "next/server"
import { assertStockSyncLogsAccess } from "@/lib/verify-stock-sync-logs-access"
import {
  decidePrescriptionReview,
  listPrescriptionReviewCandidates,
  prescriptionReviewStats,
  clearNonPharmacyRxFlags,
} from "@/lib/admin-prescription-review"
import { getAdminServletUrl, getJavaWarContext } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JavaJson = Record<string, unknown>

async function proxyAdminPrescription(
  req: NextRequest,
  action: string,
  extra: Record<string, string>,
): Promise<{ json: JavaJson | null; status: number; reached: boolean }> {
  const email = req.headers.get("x-admin-email")?.trim() || ""
  const token = req.headers.get("x-admin-token")?.trim() || ""
  const form = new URLSearchParams({ action, ...extra })
  if (email) form.set("adminEmail", email)
  if (token) form.set("adminToken", token)
  const inboundCookie = req.headers.get("cookie") || ""
  try {
    const res = await fetch(getAdminServletUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...(inboundCookie ? { Cookie: inboundCookie } : {}),
        ...(token ? { "X-Admin-Token": token } : {}),
      },
      body: form.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    })
    const text = await res.text()
    try {
      const data = JSON.parse(text) as JavaJson
      if (data && typeof data === "object") {
        return { json: data, status: res.status, reached: true }
      }
    } catch {
      /* not JSON — servlet not deployed or wrong URL */
    }
    return { json: null, status: res.status, reached: true }
  } catch {
    return { json: null, status: 0, reached: false }
  }
}

function javaUnavailableHint(java: { json: JavaJson | null; status: number; reached: boolean }): string {
  const adminUrl = getAdminServletUrl()
  const war = getJavaWarContext()
  if (java.json && typeof java.json.error === "string") {
    const err = String(java.json.error)
    if (/unknown action/i.test(err)) {
      return (
        `Kaos AdminServlet at ${adminUrl} does not have prescription-review actions yet. ` +
        `Redeploy the ${war} WAR with listPrescriptionReview / prescriptionReviewStats. ` +
        "Those actions use MySQLConnector (same DB as search), not Next.js GQ_MYSQL_*."
      )
    }
    return err
  }
  if (!java.reached) {
    return (
      `Could not reach kaos AdminServlet at ${adminUrl}. ` +
      "Set BACKEND_URL / JAVA_BACKEND_BASE to this host's Tomcat context (same WAR as search). " +
      "Prescription review loads niki.niki_items via MySQLConnector after that WAR is redeployed."
    )
  }
  return (
    `Kaos AdminServlet at ${adminUrl} did not return JSON for prescription review. ` +
    `Redeploy the ${war} WAR so listPrescriptionReview uses MySQLConnector (niki.niki_items).`
  )
}

/**
 * GET /api/admin/prescription-review
 * Prefers kaos AdminServlet (MySQLConnector / Trading_*.war), then Next MySQL env.
 */
export async function GET(req: NextRequest) {
  const denied = await assertStockSyncLogsAccess(req)
  if (denied) return denied

  try {
    const sp = req.nextUrl.searchParams
    if (sp.get("stats") === "1") {
      const java = await proxyAdminPrescription(req, "prescriptionReviewStats", {})
      if (java.json?.ok === true && java.json.stats) {
        return NextResponse.json(java.json)
      }
      if (java.json && java.json.ok === false) {
        return NextResponse.json(
          { ok: false, error: javaUnavailableHint(java) },
          { status: java.status >= 400 ? java.status : 502 },
        )
      }
      try {
        const stats = await prescriptionReviewStats()
        return NextResponse.json({ ok: true, stats, source: "next-mysql" })
      } catch (fallbackErr) {
        const fallback = fallbackErr instanceof Error ? fallbackErr.message : "Next MySQL unavailable"
        return NextResponse.json(
          { ok: false, error: `${javaUnavailableHint(java)} ${fallback}` },
          { status: 502 },
        )
      }
    }
    const extra: Record<string, string> = {
      page: String(Number(sp.get("page") || 1) || 1),
      limit: String(Number(sp.get("limit") || 40) || 40),
      filter: sp.get("filter") || "pending",
    }
    const q = sp.get("q")?.trim()
    const famille = sp.get("famille")?.trim()
    if (q) extra.q = q
    if (famille) extra.famille = famille
    const java = await proxyAdminPrescription(req, "listPrescriptionReview", extra)
    if (java.json?.ok === true && Array.isArray(java.json.items)) {
      return NextResponse.json(java.json)
    }
    if (java.json && java.json.ok === false) {
      return NextResponse.json(
        { ok: false, error: javaUnavailableHint(java) },
        { status: java.status >= 400 ? java.status : 502 },
      )
    }

    try {
      const result = await listPrescriptionReviewCandidates({
        q: q || undefined,
        famille: famille || undefined,
        filter: (sp.get("filter") as "pending" | "reviewed" | "all_unflagged" | "rx") || "pending",
        page: Number(sp.get("page") || 1) || 1,
        limit: Number(sp.get("limit") || 40) || 40,
      })
      return NextResponse.json({ ...result, source: "next-mysql" })
    } catch (fallbackErr) {
      const fallback = fallbackErr instanceof Error ? fallbackErr.message : "Next MySQL unavailable"
      return NextResponse.json(
        { ok: false, error: `${javaUnavailableHint(java)} ${fallback}` },
        { status: 502 },
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load prescription review queue"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await assertStockSyncLogsAccess(req)
  if (denied) return denied

  try {
    const body = (await req.json().catch(() => ({}))) as {
      nikiCode?: string
      decision?: "rx" | "otc"
      note?: string
      clearNonPharmacy?: boolean
    }
    if (body.clearNonPharmacy === true) {
      const java = await proxyAdminPrescription(req, "clearNonPharmacyPrescriptionFlags", {})
      if (java.json?.ok === true) {
        return NextResponse.json(java.json)
      }
      if (java.json && java.json.ok === false) {
        return NextResponse.json(
          { ok: false, error: javaUnavailableHint(java) },
          { status: java.status >= 400 ? java.status : 502 },
        )
      }
      try {
        const result = await clearNonPharmacyRxFlags()
        return NextResponse.json({ ...result, source: "next-mysql" })
      } catch (fallbackErr) {
        const fallback = fallbackErr instanceof Error ? fallbackErr.message : "Next MySQL unavailable"
        return NextResponse.json(
          { ok: false, error: `${javaUnavailableHint(java)} ${fallback}` },
          { status: 502 },
        )
      }
    }
    if (body.decision !== "rx" && body.decision !== "otc") {
      return NextResponse.json(
        { ok: false, error: "decision must be 'rx' or 'otc'" },
        { status: 400 },
      )
    }
    const extra: Record<string, string> = {
      nikiCode: String(body.nikiCode || ""),
      decision: body.decision,
    }
    if (body.note) extra.note = body.note
    const java = await proxyAdminPrescription(req, "decidePrescriptionReview", extra)
    if (java.json?.ok === true) {
      return NextResponse.json(java.json)
    }
    if (java.json && java.json.ok === false) {
      return NextResponse.json(
        { ok: false, error: javaUnavailableHint(java) },
        { status: java.status >= 400 ? java.status : 502 },
      )
    }

    try {
      const reviewerEmail = req.headers.get("x-admin-email")?.trim() || ""
      const result = await decidePrescriptionReview({
        nikiCode: String(body.nikiCode || ""),
        decision: body.decision,
        note: body.note,
        reviewerEmail,
      })
      return NextResponse.json(result)
    } catch (fallbackErr) {
      const fallback = fallbackErr instanceof Error ? fallbackErr.message : "Next MySQL unavailable"
      return NextResponse.json(
        { ok: false, error: `${javaUnavailableHint(java)} ${fallback}` },
        { status: 502 },
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save review decision"
    const status = /required|must be/i.test(message) ? 400 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
