/**
 * eRx Market MySQL — same resolver chain as onboarding / GQ (beta.ihute.rw Kaos schema).
 * Reads pharmacy_metrics when present; falls back to seller_add_stock heartbeats for last_sync.
 */

import type { Pool, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"

import { normalizeSupplierLatLng } from "@/lib/geo-haversine"

type SyncRow = RowDataPacket & {
  account: string
  last_sync: Date | string | null
}

export type ErxPharmacyDbMetrics = {
  /** account_seller.rating_star (1–5), null if never rated. */
  stars: number | null
  /** account_seller.certificate parsed 0–10 (stock quality score). */
  stockAcc: number | null
  /** Minutes since MAX(seller_add_stock.SYNCED_TIME); 999 = unknown/stale. */
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

function parseRatingStar(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.max(1, Math.min(5, Math.round(n * 10) / 10))
}

/** certificate column on account_seller — operational stock score 0–10. */
function parseCertificateScore(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n = Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(10, Math.round(n)))
}

type SellerMetricsRow = RowDataPacket & {
  id: string
  rating_star: number | string | null
  certificate: string | number | null
}

/**
 * Stars + stock + last POS sync for eRx candidate cards (step 3).
 * Sources (beta/Kaos):
 *   ★ stars     → account_seller.rating_star (fallback account_signup)
 *   Stock /10   → account_seller.certificate (fallback account_signup)
 *   Sync        → MAX(seller_add_stock.SYNCED_TIME) per pharmacy
 */
export async function fetchPharmacyMetricsByIds(
  pharmacyIds: string[],
): Promise<Map<string, ErxPharmacyDbMetrics>> {
  const out = new Map<string, ErxPharmacyDbMetrics>()
  const ids = [...new Set(pharmacyIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return out

  const p = getErxMysqlPool()
  if (!p) return out

  const ensure = (id: string): ErxPharmacyDbMetrics => {
    const prev = out.get(id)
    if (prev) return prev
    const row: ErxPharmacyDbMetrics = { stars: null, stockAcc: null, lastSyncMin: 999 }
    out.set(id, row)
    return row
  }

  const ingestSellerRows = (rows: SellerMetricsRow[]) => {
    for (const row of rows) {
      const id = String(row.id ?? "").trim()
      if (!id) continue
      const m = ensure(id)
      const star = parseRatingStar(row.rating_star)
      const cert = parseCertificateScore(row.certificate)
      if (star != null) m.stars = star
      if (cert != null) m.stockAcc = cert
    }
  }

  try {
    const ph = ids.map(() => "?").join(",")
    const [sellerRows] = await p.query<SellerMetricsRow[]>(
      `SELECT ishyiga_account AS id, rating_star, certificate
       FROM account_seller
       WHERE ishyiga_account IN (${ph})`,
      ids,
    )
    ingestSellerRows(sellerRows)
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[erx-mysql] account_seller metrics:", e instanceof Error ? e.message : e)
    }
  }

  const missingSeller = ids.filter((id) => {
    const m = out.get(id)
    return !m || (m.stars == null && m.stockAcc == null)
  })
  if (missingSeller.length) {
    try {
      const ph = missingSeller.map(() => "?").join(",")
      const [signupRows] = await p.query<SellerMetricsRow[]>(
        `SELECT ISHYIGA_ACCOUNT AS id, rating_star, certificate
         FROM account_signup
         WHERE ISHYIGA_ACCOUNT IN (${ph})`,
        missingSeller,
      )
      ingestSellerRows(signupRows)
    } catch {
      /* account_signup optional */
    }
  }

  try {
    const ph = ids.map(() => "?").join(",")
    const [syncRows] = await p.query<SyncRow[]>(
      `SELECT SELLER_ISHYIGA_ACCOUNT AS account, MAX(SYNCED_TIME) AS last_sync
       FROM seller_add_stock
       WHERE SELLER_ISHYIGA_ACCOUNT IN (${ph})
       GROUP BY SELLER_ISHYIGA_ACCOUNT`,
      ids,
    )
    for (const row of syncRows) {
      const id = String(row.account)
      const m = ensure(id)
      m.lastSyncMin = minutesSince(row.last_sync)
    }
  } catch {
    /* seller_add_stock optional */
  }

  for (const id of ids) ensure(id)
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
