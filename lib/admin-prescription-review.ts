/**
 * Pharmacist Rx review — list + decide on niki_items, mirror seller_add_stock.
 * MySQL: same marketplace DB as kaos MySQLConnector (GQ_MYSQL_* / ONBOARDING_* / DB_URL+DB_USER+DB_PASS).
 * Catalog rows are read from qualified `niki.niki_items` (override via NIKI_MYSQL_DATABASE).
 */
import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise"
import { pharmacyCategorySql } from "@/lib/prescription-review-constants"
import {
  getKaosAlignedMysqlConfig,
  kaosAlignedMysqlConfigHint,
  toKaosAlignedPoolOptions,
} from "@/lib/kaos-mysql-config"

let pool: Pool | null = null

function nikiDb(): string {
  const raw = (process.env.NIKI_MYSQL_DATABASE || "niki").trim()
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return "niki"
  return raw
}

function marketplaceDb(): string {
  const cfg = getKaosAlignedMysqlConfig()
  if (cfg?.database) return cfg.database
  return (
    process.env.GQ_MYSQL_DATABASE ||
    process.env.ONBOARDING_MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE ||
    "chaos_dev"
  ).trim()
}

function dbPool(): Pool {
  if (pool) return pool
  const cfg = getKaosAlignedMysqlConfig()
  if (!cfg) {
    throw new Error(kaosAlignedMysqlConfigHint())
  }
  pool = mysql.createPool(toKaosAlignedPoolOptions(cfg))
  return pool
}

export type PrescriptionReviewItem = {
  nikiCode: string
  itemName: string
  famille: string
  requiresPrescription: number
  prescriptionReason: string
  stockSellers: number
}

export type ListPrescriptionReviewArgs = {
  q?: string
  famille?: string
  /** pending = unflagged in drug buckets; rx = already marked prescription; reviewed = pharmacist:* */
  filter?: "pending" | "all_unflagged" | "reviewed" | "rx"
  page?: number
  limit?: number
}

const PHARMACY_SQL = pharmacyCategorySql("f.famille", "n.category_id")
const PHARMACY_STOCK_FAMILLE = `COALESCE(
  MAX(CASE WHEN ${pharmacyCategorySql("FAMILLE", "NULL")} THEN UPPER(TRIM(FAMILLE)) END),
  UPPER(TRIM(MAX(NULLIF(TRIM(FAMILLE), ''))))
)`

export async function listPrescriptionReviewCandidates(
  args: ListPrescriptionReviewArgs,
): Promise<{ ok: true; items: PrescriptionReviewItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Number(args.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 40))
  const offset = (page - 1) * limit
  const q = String(args.q || "").trim()
  const familleFilter = String(args.famille || "").trim().toUpperCase()
  const filter = args.filter || "pending"

  const niki = nikiDb()
  const mkt = marketplaceDb()

  const where: string[] = [PHARMACY_SQL]
  const params: unknown[] = []

  if (filter === "reviewed") {
    where.push(`COALESCE(n.prescription_reason, '') LIKE 'pharmacist:%'`)
  } else if (filter === "rx") {
    where.push(`COALESCE(n.requires_prescription, 0) = 1`)
  } else {
    where.push(`COALESCE(n.requires_prescription, 0) = 0`)
    where.push(`COALESCE(n.prescription_reason, '') NOT LIKE 'seed:%'`)
    where.push(`COALESCE(n.prescription_reason, '') NOT LIKE 'backfill:keyword:%'`)
  }

  if (familleFilter && familleFilter !== "ALL") {
    where.push(`f.famille = ?`)
    params.push(familleFilter)
  }
  if (q) {
    where.push(`(n.niki_code LIKE ? OR n.item_commercial_name LIKE ?)`)
    const like = `%${q}%`
    params.push(like, like)
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

  const fromSql = `
    FROM \`${niki}\`.niki_items n
    LEFT JOIN (
      SELECT
        NIKI_CODE AS niki_code,
        ${PHARMACY_STOCK_FAMILLE} AS famille,
        COUNT(DISTINCT SELLER_ISHYIGA_ACCOUNT) AS stock_sellers
      FROM \`${mkt}\`.seller_add_stock
      WHERE NIKI_CODE IS NOT NULL AND TRIM(NIKI_CODE) <> ''
      GROUP BY NIKI_CODE
    ) f ON f.niki_code = n.niki_code
  `

  const countSql = `SELECT COUNT(*) AS c ${fromSql} ${whereSql}`
  const [countRows] = await dbPool().query<RowDataPacket[]>(countSql, params)
  const total = Number(countRows[0]?.c || 0)

  const listSql = `
    SELECT
      n.niki_code AS nikiCode,
      COALESCE(n.item_commercial_name, '') AS itemName,
      COALESCE(f.famille, '') AS famille,
      COALESCE(n.requires_prescription, 0) AS requiresPrescription,
      COALESCE(n.prescription_reason, '') AS prescriptionReason,
      COALESCE(f.stock_sellers, 0) AS stockSellers
    ${fromSql}
    ${whereSql}
    ORDER BY
      CASE WHEN COALESCE(n.prescription_reason, '') LIKE 'pending_review:%' THEN 0 ELSE 1 END,
      f.famille ASC,
      n.item_commercial_name ASC
    LIMIT ? OFFSET ?
  `
  const [rows] = await dbPool().query<RowDataPacket[]>(listSql, [...params, limit, offset])

  const items: PrescriptionReviewItem[] = (rows || []).map((r) => ({
    nikiCode: String(r.nikiCode || ""),
    itemName: String(r.itemName || ""),
    famille: String(r.famille || ""),
    requiresPrescription: Number(r.requiresPrescription) || 0,
    prescriptionReason: String(r.prescriptionReason || ""),
    stockSellers: Number(r.stockSellers) || 0,
  }))

  return { ok: true, items, total, page, limit }
}

export type DecidePrescriptionArgs = {
  nikiCode: string
  /** rx = requires prescription; otc = does not */
  decision: "rx" | "otc"
  reviewerEmail?: string
  note?: string
}

export async function decidePrescriptionReview(
  args: DecidePrescriptionArgs,
): Promise<{ ok: true; nikiCode: string; requiresPrescription: number; mirrored: number }> {
  const code = String(args.nikiCode || "").trim()
  if (!code) throw new Error("nikiCode is required")
  if (args.decision !== "rx" && args.decision !== "otc") {
    throw new Error("decision must be 'rx' or 'otc'")
  }

  const niki = nikiDb()
  const mkt = marketplaceDb()
  const requires = args.decision === "rx" ? 1 : 0
  const note = String(args.note || "").trim().slice(0, 120)
  const who = String(args.reviewerEmail || "").trim().slice(0, 80)
  const reason = [
    "pharmacist:reviewed",
    args.decision === "rx" ? "rx" : "otc",
    who ? `by:${who}` : "",
    note ? `note:${note}` : "",
  ]
    .filter(Boolean)
    .join(":")
    .slice(0, 255)

  const [upd] = await dbPool().execute<ResultSetHeader>(
    `UPDATE \`${niki}\`.niki_items
     SET requires_prescription = ?, prescription_reason = ?
     WHERE niki_code = ?`,
    [requires, reason, code],
  )
  if (!upd.affectedRows) {
    throw new Error(`No niki_items row for ${code}`)
  }

  const [mir] = await dbPool().execute<ResultSetHeader>(
    `UPDATE \`${mkt}\`.seller_add_stock s
     INNER JOIN \`${niki}\`.niki_items n ON n.niki_code = s.NIKI_CODE
     SET s.requires_prescription = n.requires_prescription
     WHERE s.NIKI_CODE = ?`,
    [code],
  )

  return {
    ok: true,
    nikiCode: code,
    requiresPrescription: requires,
    mirrored: Number(mir.affectedRows) || 0,
  }
}

export async function clearNonPharmacyRxFlags(): Promise<{
  ok: true
  nikiUpdated: number
  stockUpdated: number
}> {
  const niki = nikiDb()
  const mkt = marketplaceDb()
  const pharmacy = pharmacyCategorySql("f.famille", "n.category_id")
  const pharmacyStock = pharmacyCategorySql("s.FAMILLE", "n.category_id")

  const [nikiRes] = await dbPool().execute<ResultSetHeader>(
    `UPDATE \`${niki}\`.niki_items n
     LEFT JOIN (
       SELECT NIKI_CODE AS niki_code,
              ${PHARMACY_STOCK_FAMILLE} AS famille
       FROM \`${mkt}\`.seller_add_stock
       WHERE NIKI_CODE IS NOT NULL AND TRIM(NIKI_CODE) <> ''
       GROUP BY NIKI_CODE
     ) f ON f.niki_code = n.niki_code
     SET n.requires_prescription = 0,
         n.prescription_reason = LEFT(CONCAT('backfill:non-pharmacy-unflag:', COALESCE(n.prescription_reason, '')), 255)
     WHERE COALESCE(n.requires_prescription, 0) = 1
       AND NOT ${pharmacy}`,
  )

  const [stockRes] = await dbPool().execute<ResultSetHeader>(
    `UPDATE \`${mkt}\`.seller_add_stock s
     LEFT JOIN \`${niki}\`.niki_items n ON (n.niki_code = s.NIKI_CODE OR n.niki_code = s.ITEM_CODE)
     SET s.requires_prescription = 0
     WHERE COALESCE(s.requires_prescription, 0) = 1
       AND NOT ${pharmacyStock}`,
  )

  return {
    ok: true,
    nikiUpdated: Number(nikiRes.affectedRows) || 0,
    stockUpdated: Number(stockRes.affectedRows) || 0,
  }
}

export async function prescriptionReviewStats(): Promise<{
  unflaggedInDrugBuckets: number
  pendingReviewReason: number
  pharmacistReviewed: number
  rxRequired: number
}> {
  const niki = nikiDb()
  const mkt = marketplaceDb()

  const [rows] = await dbPool().query<RowDataPacket[]>(
    `
    SELECT
      SUM(COALESCE(n.requires_prescription, 0) = 0 AND ${PHARMACY_SQL}) AS unflaggedInDrugBuckets,
      SUM(COALESCE(n.prescription_reason, '') LIKE 'pending_review:%' AND ${PHARMACY_SQL}) AS pendingReviewReason,
      SUM(COALESCE(n.prescription_reason, '') LIKE 'pharmacist:%' AND ${PHARMACY_SQL}) AS pharmacistReviewed,
      SUM(COALESCE(n.requires_prescription, 0) = 1 AND ${PHARMACY_SQL}) AS rxRequired
    FROM \`${niki}\`.niki_items n
    LEFT JOIN (
      SELECT NIKI_CODE AS niki_code,
             ${PHARMACY_STOCK_FAMILLE} AS famille
      FROM \`${mkt}\`.seller_add_stock
      WHERE NIKI_CODE IS NOT NULL AND TRIM(NIKI_CODE) <> ''
      GROUP BY NIKI_CODE
    ) f ON f.niki_code = n.niki_code
    `,
  )

  return {
    unflaggedInDrugBuckets: Number(rows[0]?.unflaggedInDrugBuckets || 0),
    pendingReviewReason: Number(rows[0]?.pendingReviewReason || 0),
    pharmacistReviewed: Number(rows[0]?.pharmacistReviewed || 0),
    rxRequired: Number(rows[0]?.rxRequired || 0),
  }
}

export { DRUG_FAMILLES } from "@/lib/prescription-review-constants"