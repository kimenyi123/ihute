import type { RowDataPacket } from "mysql2/promise"
import { getSearchAnalyticsPool } from "@/lib/mysql-search-analytics"

type Row = RowDataPacket & Record<string, unknown>

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Units sold per ITEM_CODE for a seller over the last {@code lookbackDays} days.
 * Powers the shop-with-me FMCG (fast-moving) section.
 */
export async function fetchShopItemOrderSales(
  sellerAccount: string,
  lookbackDays = 30,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const seller = nz(sellerAccount)
  if (!seller) return out

  const pool = getSearchAnalyticsPool()
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
  lookbackDays = 30,
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
      const code = nz(p.ITEM_CODE ?? p.item_code ?? p.item_key_words).toUpperCase()
      if (!code) continue
      const qty = sold.get(code)
      if (qty == null || qty <= 0) continue
      p.totalSold = qty
      p.salesVelocity = qty / lookbackDays
      hit++
    }
    console.log(
      `[API shop-with-me] FMCG sales enrichment: ${hit}/${products.length} products for ${account}`,
    )
  }
}
