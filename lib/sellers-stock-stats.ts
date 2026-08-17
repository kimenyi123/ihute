import type { RowDataPacket } from "mysql2/promise"
import { getSearchAnalyticsPool } from "@/lib/mysql-search-analytics"

export type SellerStockRow = {
  sellerAccount: string
  sellerName: string
  shopNickname: string
  status: string
  productCount: number
  inStockCount: number
  outOfStockCount: number
  lowStockCount: number
  totalUnits: number
  stockValue: number
}

export type SellersStockSummary = {
  ok: true
  currency: "RWF"
  sellersWithStock: number
  sellersWithCatalog: number
  totalProducts: number
  totalInStockProducts: number
  totalUnits: number
  totalStockValue: number
  sellers: SellerStockRow[]
  source: "mysql"
}

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
 * Aggregates LIVE sellers from {@code seller_add_stock} the same table SupplierStock
 * uses for /supplier/dashboard "My Products".
 *
 * In-stock = QUANTITY &gt; 0 and SALE_PRICE_INCLUSIVE &gt; 0 (matches dashboard price filter).
 */
export async function fetchSellersWithStockFromMysql(opts?: {
  sellerAccount?: string
  onlyWithStock?: boolean
  limit?: number
}): Promise<SellersStockSummary | null> {
  const pool = getSearchAnalyticsPool()
  if (!pool) return null

  const seller = nz(opts?.sellerAccount)
  const onlyWithStock = opts?.onlyWithStock !== false
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 200))

  const sellerClause = seller ? " AND a.ISHYIGA_ACCOUNT = ?" : ""
  const havingClause = onlyWithStock ? " HAVING in_stock_count > 0" : ""

  const sql = `
    SELECT
      a.ISHYIGA_ACCOUNT AS seller_account,
      COALESCE(
        NULLIF(TRIM(a.OWNER), ''),
        TRIM(CONCAT(COALESCE(a.FIRSTNAME, ''), ' ', COALESCE(a.LASTNAME, '')))
      ) AS seller_name,
      COALESCE(NULLIF(TRIM(a.nickname), ''), '') AS shop_nickname,
      COALESCE(NULLIF(TRIM(a.STATUS), ''), '') AS status,
      COUNT(s.ID) AS product_count,
      SUM(
        CASE
          WHEN COALESCE(s.QUANTITY, 0) > 0
           AND COALESCE(s.SALE_PRICE_INCLUSIVE, 0) > 0
          THEN 1 ELSE 0
        END
      ) AS in_stock_count,
      SUM(CASE WHEN COALESCE(s.QUANTITY, 0) = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
      SUM(
        CASE
          WHEN COALESCE(s.QUANTITY, 0) > 0 AND COALESCE(s.QUANTITY, 0) <= 10
           AND COALESCE(s.SALE_PRICE_INCLUSIVE, 0) > 0
          THEN 1 ELSE 0
        END
      ) AS low_stock_count,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(s.QUANTITY, 0) > 0 AND COALESCE(s.SALE_PRICE_INCLUSIVE, 0) > 0
          THEN s.QUANTITY ELSE 0
        END
      ), 0) AS total_units,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(s.QUANTITY, 0) > 0 AND COALESCE(s.SALE_PRICE_INCLUSIVE, 0) > 0
          THEN s.QUANTITY * s.SALE_PRICE_INCLUSIVE ELSE 0
        END
      ), 0) AS stock_value
    FROM account_seller a
    INNER JOIN seller_add_stock s ON s.SELLER_ISHYIGA_ACCOUNT = a.ISHYIGA_ACCOUNT
    WHERE a.STATUS = 'LIVE'${sellerClause}
    GROUP BY a.ISHYIGA_ACCOUNT, seller_name, shop_nickname, status
    ${havingClause}
    ORDER BY in_stock_count DESC, stock_value DESC
    LIMIT ${limit}
  `

  const [rows] = await pool.execute<Row[]>(sql, seller ? [seller] : [])

  const sellers: SellerStockRow[] = rows.map((r) => ({
    sellerAccount: nz(r.seller_account),
    sellerName: nz(r.seller_name) || nz(r.seller_account),
    shopNickname: nz(r.shop_nickname),
    status: nz(r.status) || "LIVE",
    productCount: num(r.product_count),
    inStockCount: num(r.in_stock_count),
    outOfStockCount: num(r.out_of_stock_count),
    lowStockCount: num(r.low_stock_count),
    totalUnits: num(r.total_units),
    stockValue: num(r.stock_value),
  }))

  return {
    ok: true,
    currency: "RWF",
    sellersWithStock: sellers.filter((s) => s.inStockCount > 0).length,
    sellersWithCatalog: sellers.length,
    totalProducts: sellers.reduce((n, s) => n + s.productCount, 0),
    totalInStockProducts: sellers.reduce((n, s) => n + s.inStockCount, 0),
    totalUnits: sellers.reduce((n, s) => n + s.totalUnits, 0),
    totalStockValue: sellers.reduce((n, s) => n + s.stockValue, 0),
    sellers,
    source: "mysql",
  }
}
