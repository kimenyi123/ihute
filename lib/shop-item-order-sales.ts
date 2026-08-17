import type { Pool, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"
import { VELOCITY_LOOKBACK_DAYS } from "@/lib/sales-velocity"
import { lookupUnitsSold } from "@/lib/order-sales-lookup"

export { lookupUnitsSold } from "@/lib/order-sales-lookup"

type Row = RowDataPacket & Record<string, unknown>

let orderSalesPool: Pool | null = null
let orderSalesPoolTried = false

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Same order DB as Kaos / GQ invoices (prefer GQ_MYSQL_*, then ONBOARDING_*, then MYSQL_*).
 * Search-analytics pool alone is not enough — many local setups only have GQ_MYSQL_*.
 */
function getOrderSalesPool(): Pool | null {
  if (orderSalesPool) return orderSalesPool
  if (orderSalesPoolTried) return null
  orderSalesPoolTried = true

  const host =
    process.env.GQ_MYSQL_HOST ||
    process.env.ONBOARDING_MYSQL_HOST ||
    process.env.FORGOT_PASSWORD_MYSQL_HOST ||
    process.env.MYSQL_HOST
  const user =
    process.env.GQ_MYSQL_USER ||
    process.env.ONBOARDING_MYSQL_USER ||
    process.env.FORGOT_PASSWORD_MYSQL_USER ||
    process.env.MYSQL_USER
  const password =
    process.env.GQ_MYSQL_PASSWORD ??
    process.env.ONBOARDING_MYSQL_PASSWORD ??
    process.env.FORGOT_PASSWORD_MYSQL_PASSWORD ??
    process.env.MYSQL_PASSWORD ??
    ""
  const database =
    process.env.GQ_MYSQL_DATABASE ||
    process.env.ONBOARDING_MYSQL_DATABASE ||
    process.env.FORGOT_PASSWORD_MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE

  if (!host || !user || !database) {
    console.warn(
      "[shop-item-order-sales] No MySQL config (set GQ_MYSQL_* or ONBOARDING_MYSQL_* or MYSQL_*)",
    )
    return null
  }

  orderSalesPool = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    connectTimeout: 10_000,
  })
  return orderSalesPool
}

/**
 * Units sold per ITEM_CODE for a seller over the last {@code lookbackDays} days.
 * Powers shop-with-me + supplier dashboard FMCG.
 */
export async function fetchShopItemOrderSales(
  sellerAccount: string,
  lookbackDays = VELOCITY_LOOKBACK_DAYS,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const seller = nz(sellerAccount)
  if (!seller) return out

  const pool = getOrderSalesPool()
  if (!pool) return out

  const days = Math.max(1, Math.min(lookbackDays, 365))
  try {
    const [rows] = await pool.execute<Row[]>(
      `SELECT TRIM(otl.ITEM_CODE) AS item_code,
              SUM(COALESCE(otl.QUANTITY, 0)) AS qty_sold
       FROM order_transaction_list otl
       INNER JOIN order_transaction ot ON ot.ID_ORDER = otl.ID_ORDER
       WHERE otl.SELLER_ISHYIGA_ACCOUNT = ?
         AND ot.ORDER_STATUS != 'CANCELLED'
         AND ot.heure >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND TRIM(COALESCE(otl.ITEM_CODE,'')) <> ''
       GROUP BY TRIM(otl.ITEM_CODE)
       HAVING qty_sold > 0`,
      [seller, days],
    )
    for (const r of rows ?? []) {
      const code = nz(r.item_code).toUpperCase()
      const qty = num(r.qty_sold)
      if (code && qty > 0) out.set(code, qty)
    }
  } catch (e) {
    console.warn("[shop-item-order-sales] query failed:", e)
  }
  return out
}

/** Attach totalSold on each product from order history (no-op if already set). */
export async function enrichShopProductsWithOrderSales(
  data: { sellers?: Array<{ ISHYIGA_ACCOUNT?: string; products?: Record<string, unknown>[] }> },
  lookbackDays = VELOCITY_LOOKBACK_DAYS,
): Promise<void> {
  const sellers = data.sellers ?? []
  for (const seller of sellers) {
    const account = nz(seller.ISHYIGA_ACCOUNT)
    const products = seller.products ?? []
    if (!account || products.length === 0) continue

    const already = products.some((p) => num(p.totalSold) > 0)
    if (already) continue

    const sold = await fetchShopItemOrderSales(account, lookbackDays)
    if (sold.size === 0) continue

    let hit = 0
    for (const p of products) {
      const qty = lookupUnitsSold(p, sold)
      if (qty <= 0) continue
      p.totalSold = qty
      p.salesVelocity = qty / lookbackDays
      hit++
    }
    console.log(
      `[API shop-with-me] FMCG sales enrichment: ${hit}/${products.length} products for ${account}`,
    )
  }
}
