/**
 * Persist final prescription image URL on order_transaction after pending→order move.
 */
import mysql, { type Pool, type ResultSetHeader } from "mysql2/promise"

let pool: Pool | null = null

function dbPool(): Pool {
  if (pool) return pool
  const host =
    process.env.GQ_MYSQL_HOST ||
    process.env.ONBOARDING_MYSQL_HOST ||
    process.env.MYSQL_HOST
  const user =
    process.env.GQ_MYSQL_USER ||
    process.env.ONBOARDING_MYSQL_USER ||
    process.env.MYSQL_USER
  const password =
    process.env.GQ_MYSQL_PASSWORD ??
    process.env.ONBOARDING_MYSQL_PASSWORD ??
    process.env.MYSQL_PASSWORD
  const database =
    process.env.GQ_MYSQL_DATABASE ||
    process.env.ONBOARDING_MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE
  if (!host || !user || password === undefined || !database) {
    throw new Error(
      "Order MySQL is not configured. Set GQ_MYSQL_* or ONBOARDING_MYSQL_* or MYSQL_* in .env.local.",
    )
  }
  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    connectionLimit: 3,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  })
  return pool
}

export async function persistOrderPrescriptionUrl(
  orderId: number,
  publicUrl: string,
): Promise<void> {
  const url = String(publicUrl || "").trim()
  if (!Number.isFinite(orderId) || orderId <= 0 || !url) return
  try {
    await dbPool().execute<ResultSetHeader>(
      `UPDATE order_transaction SET PRESCRIPTION_IMAGE_URL = ? WHERE ID_ORDER = ?`,
      [url.slice(0, 1024), orderId],
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Unknown column|PRESCRIPTION_IMAGE_URL/i.test(msg)) {
      console.warn("[order-prescription] column missing — run migration_prescription_required.sql")
      return
    }
    throw e
  }
}
