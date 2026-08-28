/**
 * Persist every eRx pull, unlock attempt, RFQ, and service milestone to erx_tracking.
 */

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"

import { getErxMysqlPool } from "@/lib/erx/erx-mysql"

export type ErxTrackingEventType = "LOOKUP" | "RFQ" | "CHOOSE" | "PAY" | "DELIVER" | "RATE"
export type ErxTrackingStatus = "SUCCESS" | "FAIL" | "PENDING"
export type ErxTrackingStage = "UNLOCK" | "CANDIDATES" | "RFQ" | "QUOTES" | "PAID" | "DELIVERED"

export type ErxTrackingInsert = {
  eventType: ErxTrackingEventType
  erxCode: string
  status: ErxTrackingStatus
  failCode?: string | null
  failMessage?: string | null
  unlockKeyType?: string | null
  unlockKeyHint?: string | null
  requestedAt?: Date
  respondedAt?: Date
  durationMs?: number
  patientDisplayName?: string | null
  drugCount?: number
  drugsJson?: unknown
  orderId?: string | null
  pharmaciesRequested?: Array<{ id: string; name?: string }>
  pharmaciesInserted?: number
  posSummary?: string | null
  pickedPharmacyId?: string | null
  pickedPharmacyName?: string | null
  serviceStage?: ErxTrackingStage | null
  posTransactionId?: string | null
  clientIp?: string | null
  userAgent?: string | null
  meta?: Record<string, unknown>
}

export function maskUnlockHint(input: {
  phone?: string
  names?: string
  nationalId?: string
}): { type: string; hint: string } {
  const phone = (input.phone || "").trim()
  const names = (input.names || "").trim()
  const nationalId = (input.nationalId || "").trim()
  const parts: string[] = []
  if (phone) {
    const digits = phone.replace(/\D/g, "")
    parts.push("phone")
    if (digits.length >= 4) return { type: parts.length > 1 ? "mixed" : "phone", hint: `***${digits.slice(-4)}` }
    return { type: "phone", hint: "***" }
  }
  if (names) {
    const first = names.split(/\s+/)[0] || names
    parts.push("names")
    return { type: parts.length > 1 ? "mixed" : "names", hint: first.slice(0, 24) }
  }
  if (nationalId) {
    parts.push("nationalId")
    const digits = nationalId.replace(/\s/g, "")
    return {
      type: "nationalId",
      hint: digits.length >= 4 ? `***${digits.slice(-4)}` : "***",
    }
  }
  return { type: "unknown", hint: "" }
}

export async function insertErxTracking(row: ErxTrackingInsert): Promise<number | null> {
  const pool = getErxMysqlPool()
  if (!pool) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[erx-tracking] MySQL not configured — skip insert", row.eventType, row.erxCode)
    }
    return null
  }

  const requestedAt = row.requestedAt ?? new Date()
  const respondedAt = row.respondedAt ?? null
  const durationMs =
    row.durationMs ??
    (respondedAt ? Math.max(0, respondedAt.getTime() - requestedAt.getTime()) : null)

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO erx_tracking (
        event_type, erx_code, status, fail_code, fail_message,
        unlock_key_type, unlock_key_hint,
        requested_at, responded_at, duration_ms,
        patient_display_name, drug_count, drugs_json,
        order_id, pharmacies_requested, pharmacies_inserted, pos_summary,
        picked_pharmacy_id, picked_pharmacy_name,
        service_stage, pos_transaction_id,
        client_ip, user_agent, meta
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.eventType,
        row.erxCode,
        row.status,
        row.failCode ?? null,
        row.failMessage ?? null,
        row.unlockKeyType ?? null,
        row.unlockKeyHint ?? null,
        requestedAt,
        respondedAt,
        durationMs,
        row.patientDisplayName ?? null,
        row.drugCount ?? null,
        row.drugsJson != null ? JSON.stringify(row.drugsJson) : null,
        row.orderId ?? null,
        row.pharmaciesRequested?.length ? JSON.stringify(row.pharmaciesRequested) : null,
        row.pharmaciesInserted ?? null,
        row.posSummary ?? null,
        row.pickedPharmacyId ?? null,
        row.pickedPharmacyName ?? null,
        row.serviceStage ?? null,
        row.posTransactionId ?? null,
        row.clientIp ?? null,
        row.userAgent?.slice(0, 512) ?? null,
        row.meta ? JSON.stringify(row.meta) : null,
      ],
    )
    return result.insertId
  } catch (e) {
    console.error("[erx-tracking] insert failed:", e instanceof Error ? e.message : e)
    return null
  }
}

export type ErxDashboardStats = {
  totalRequested: number
  totalServed: number
  totalFailed: number
  avgResponseMs: number
  slaStarsPct: number
  slaStockPct: number
  /** Avg stock_acc / 5 across pharmacy_metrics (availability proxy). */
  stockAvailabilityPct: number
  /** Avg % of requested pharmacies that received RFQ insert (found channel). */
  discoveryRatePct: number
  pharmaciesSyncedLt3h: number
  pharmaciesTotal: number
  journeyFunnel?: Array<{ stage: string; count: number; pct: number }>
  weeklyTrend?: number[]
  discoveryBreakdown?: Array<{ label: string; pct: number }>
  recent: Array<Record<string, unknown>>
}

type CountRow = RowDataPacket & { n: number }
type AvgRow = RowDataPacket & { avg_ms: number | null }
type MetricAggRow = RowDataPacket & {
  total: number
  stars_ok: number
  stock_ok: number
  sync_ok: number
  avg_stock_acc: number | null
}
type DiscoveryRow = RowDataPacket & { discovery_pct: number | null }

export async function fetchErxDashboardStats(): Promise<ErxDashboardStats | null> {
  const pool = getErxMysqlPool()
  if (!pool) return null

  try {
    const [[lookupCounts]] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM erx_tracking WHERE event_type = 'LOOKUP'`,
    )
    const [[served]] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM erx_tracking WHERE status = 'SUCCESS' AND event_type IN ('LOOKUP','RFQ','DELIVER')`,
    )
    const [[failed]] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM erx_tracking WHERE status = 'FAIL'`,
    )
    const [[avgRow]] = await pool.query<AvgRow[]>(
      `SELECT AVG(duration_ms) AS avg_ms FROM erx_tracking WHERE duration_ms IS NOT NULL`,
    )

    let slaStarsPct = 0
    let slaStockPct = 0
    let stockAvailabilityPct = 0
    let discoveryRatePct = 0
    let pharmaciesSyncedLt3h = 0
    let pharmaciesTotal = 0

    try {
      const [[disc]] = await pool.query<DiscoveryRow[]>(
        `SELECT AVG(
           CASE
             WHEN pharmacies_requested IS NOT NULL
               AND JSON_LENGTH(pharmacies_requested) > 0
               AND pharmacies_inserted IS NOT NULL
             THEN (pharmacies_inserted / JSON_LENGTH(pharmacies_requested)) * 100
             ELSE NULL
           END
         ) AS discovery_pct
         FROM erx_tracking
         WHERE event_type = 'RFQ'`,
      )
      discoveryRatePct = Math.round(Number(disc?.discovery_pct ?? 0))
    } catch {
      /* optional */
    }

    try {
      const [[m]] = await pool.query<MetricAggRow[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN stars IS NOT NULL AND stars >= 4.0 THEN 1 ELSE 0 END) AS stars_ok,
           SUM(CASE WHEN stock_acc IS NOT NULL AND stock_acc >= 4 THEN 1 ELSE 0 END) AS stock_ok,
           SUM(CASE WHEN last_sync_at IS NOT NULL AND last_sync_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR) THEN 1 ELSE 0 END) AS sync_ok,
           AVG(stock_acc) AS avg_stock_acc
         FROM pharmacy_metrics`,
      )
      pharmaciesTotal = Number(m?.total ?? 0)
      if (pharmaciesTotal > 0) {
        slaStarsPct = Math.round((Number(m?.stars_ok ?? 0) / pharmaciesTotal) * 100)
        slaStockPct = Math.round((Number(m?.stock_ok ?? 0) / pharmaciesTotal) * 100)
        pharmaciesSyncedLt3h = Number(m?.sync_ok ?? 0)
      }
      if (m?.avg_stock_acc != null) {
        stockAvailabilityPct = Math.round((Number(m.avg_stock_acc) / 5) * 100)
      }
    } catch {
      /* pharmacy_metrics optional */
    }

    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_type, erx_code, status, fail_code, unlock_key_hint,
              requested_at, responded_at, duration_ms, patient_display_name,
              drug_count, order_id, pharmacies_inserted, picked_pharmacy_name, service_stage
       FROM erx_tracking
       ORDER BY requested_at DESC
       LIMIT 25`,
    )

    return {
      totalRequested: Number(lookupCounts?.n ?? 0),
      totalServed: Number(served?.n ?? 0),
      totalFailed: Number(failed?.n ?? 0),
      avgResponseMs: Math.round(Number(avgRow?.avg_ms ?? 0)),
      slaStarsPct,
      slaStockPct,
      stockAvailabilityPct,
      discoveryRatePct,
      pharmaciesSyncedLt3h,
      pharmaciesTotal,
      recent: recentRows as Array<Record<string, unknown>>,
    }
  } catch (e) {
    console.error("[erx-tracking] stats failed:", e instanceof Error ? e.message : e)
    return null
  }
}
