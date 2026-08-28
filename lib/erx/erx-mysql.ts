/**
 * eRx Market MySQL — same resolver chain as onboarding / GQ (beta.ihute.rw Kaos schema).
 * Reads pharmacy_metrics when present; falls back to seller_add_stock heartbeats for last_sync.
 */

import type { Pool, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"

import { normalizeSupplierLatLng } from "@/lib/geo-haversine"

type MetricsRow = RowDataPacket & {
  pharmacy_id: string
  stars: number | null
  stock_acc: number | null
  last_sync_at: Date | string | null
}

type SyncRow = RowDataPacket & {
  account: string
  last_sync: Date | string | null
}

export type ErxPharmacyDbMetrics = {
  stars: number
  stockAcc: number
  lastSyncMin: number
}

let pool: Pool | null = null
let poolTried = false

export function getErxMysqlPool(): Pool | null {
  if (pool) return pool
  if (poolTried) return null
  poolTried = true

  const host =
    process.env.GQ_MYSQL_HOST ||
    process.env.ONBOARDING_MYSQL_HOST ||
    process.env.SUPPLIER_STOCK_MYSQL_HOST ||
    process.env.MYSQL_HOST
  const user =
    process.env.GQ_MYSQL_USER ||
    process.env.ONBOARDING_MYSQL_USER ||
    process.env.SUPPLIER_STOCK_MYSQL_USER ||
    process.env.MYSQL_USER
  const password =
    process.env.GQ_MYSQL_PASSWORD ??
    process.env.ONBOARDING_MYSQL_PASSWORD ??
    process.env.SUPPLIER_STOCK_MYSQL_PASSWORD ??
    process.env.MYSQL_PASSWORD ??
    ""
  const database =
    process.env.GQ_MYSQL_DATABASE ||
    process.env.ONBOARDING_MYSQL_DATABASE ||
    process.env.SUPPLIER_STOCK_MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE
  const port = Number(process.env.ONBOARDING_MYSQL_PORT || process.env.MYSQL_PORT || 3306)

  if (!host || !user || !database) {
    console.warn("[erx-mysql] No MySQL config (set ONBOARDING_MYSQL_* or GQ_MYSQL_* like beta.ihute.rw)")
    return null
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    connectTimeout: Math.max(3000, Number(process.env.ONBOARDING_MYSQL_CONNECT_TIMEOUT_MS) || 8000),
  })
  return pool
}

function minutesSince(ts: Date | string | null | undefined): number {
  if (!ts) return 999
  const d = ts instanceof Date ? ts : new Date(ts)
  if (Number.isNaN(d.getTime())) return 999
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
}

/** Ping beta/Kaos MySQL — used by health checks; does not throw. */
export async function pingErxMysql(): Promise<{ ok: boolean; database?: string; error?: string }> {
  const p = getErxMysqlPool()
  if (!p) return { ok: false, error: "mysql_not_configured" }
  try {
    const [rows] = await p.query<RowDataPacket[]>("SELECT DATABASE() AS db")
    return { ok: true, database: String(rows[0]?.db ?? "") }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Stars / stock accuracy / last POS sync for pharmacy candidates (step 3).
 * Missing rows get conservative defaults until pharmacy_metrics is populated nightly.
 */
export async function fetchPharmacyMetricsByIds(
  pharmacyIds: string[],
): Promise<Map<string, ErxPharmacyDbMetrics>> {
  const out = new Map<string, ErxPharmacyDbMetrics>()
  const ids = [...new Set(pharmacyIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return out

  const p = getErxMysqlPool()
  if (!p) return out

  try {
    const placeholders = ids.map(() => "?").join(",")
    const [metricRows] = await p.query<MetricsRow[]>(
      `SELECT pharmacy_id, stars, stock_acc, last_sync_at
       FROM pharmacy_metrics
       WHERE pharmacy_id IN (${placeholders})`,
      ids,
    )
    for (const row of metricRows) {
      const id = String(row.pharmacy_id)
      out.set(id, {
        stars: row.stars != null ? Number(row.stars) : 4.5,
        stockAcc: row.stock_acc != null ? Number(row.stock_acc) : 3,
        lastSyncMin: minutesSince(row.last_sync_at),
      })
    }
  } catch (e) {
    // Table may not be migrated yet on beta — continue with stock heartbeat only.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[erx-mysql] pharmacy_metrics:", e instanceof Error ? e.message : e)
    }
  }

  const missingSync = ids.filter((id) => !out.has(id) || out.get(id)!.lastSyncMin >= 999)
  if (missingSync.length) {
    try {
      const ph = missingSync.map(() => "?").join(",")
      const [syncRows] = await p.query<SyncRow[]>(
        `SELECT SELLER_ISHYIGA_ACCOUNT AS account, MAX(SYNCED_TIME) AS last_sync
         FROM seller_add_stock
         WHERE SELLER_ISHYIGA_ACCOUNT IN (${ph})
         GROUP BY SELLER_ISHYIGA_ACCOUNT`,
        missingSync,
      )
      for (const row of syncRows) {
        const id = String(row.account)
        const prev = out.get(id) || { stars: 4.5, stockAcc: 3, lastSyncMin: 999 }
        out.set(id, { ...prev, lastSyncMin: minutesSince(row.last_sync) })
      }
    } catch {
      /* seller_add_stock optional */
    }
  }

  for (const id of ids) {
    if (!out.has(id)) {
      out.set(id, { stars: 4.5, stockAcc: 3, lastSyncMin: 999 })
    }
  }
  return out
}

type GpsRow = RowDataPacket & {
  id: string
  lat: number | string | null
  lng: number | string | null
}

/** GPS from account_signup, falling back to account_seller (sectorListSuppliers omits coords). */
export async function fetchPharmacyGpsByIds(
  pharmacyIds: string[],
): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>()
  const ids = [...new Set(pharmacyIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return out

  const p = getErxMysqlPool()
  if (!p) return out

  const ingest = (rows: GpsRow[]) => {
    for (const row of rows) {
      const id = String(row.id ?? "").trim()
      if (!id || out.has(id)) continue
      const norm = normalizeSupplierLatLng(row.lat, row.lng)
      if (norm) out.set(id, norm)
    }
  }

  try {
    const ph = ids.map(() => "?").join(",")
    const [signupRows] = await p.query<GpsRow[]>(
      `SELECT ISHYIGA_ACCOUNT AS id, supplier_latitude AS lat, supplier_longitude AS lng
       FROM account_signup
       WHERE ISHYIGA_ACCOUNT IN (${ph})
         AND supplier_latitude IS NOT NULL
         AND supplier_longitude IS NOT NULL`,
      ids,
    )
    ingest(signupRows)
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[erx-mysql] account_signup GPS:", e instanceof Error ? e.message : e)
    }
  }

  const missing = ids.filter((id) => !out.has(id))
  if (!missing.length) return out

  try {
    const ph = missing.map(() => "?").join(",")
    const [sellerRows] = await p.query<GpsRow[]>(
      `SELECT ishyiga_account AS id, supplier_latitude AS lat, supplier_longitude AS lng
       FROM account_seller
       WHERE ishyiga_account IN (${ph})
         AND supplier_latitude IS NOT NULL
         AND supplier_longitude IS NOT NULL`,
      missing,
    )
    ingest(sellerRows)
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[erx-mysql] account_seller GPS:", e instanceof Error ? e.message : e)
    }
  }

  return out
}
