/**
 * Order Monitor MySQL adapter for the client-order schema (chaos_theta).
 *
 * Mirrors Kaos AdminServlet getAllOrders / getOrderMonitorStats / getOrderDetails
 * so the existing /admin/orders UI keeps the same JSON contract.
 *
 * Source tables (no invented FK):
 *   {schema}.order_transaction
 *   {schema}.order_transaction_list  (join on ID_ORDER)
 *
 * Beta / Production / Dev still go through Java AdminServlet.
 */
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise"
import { CLIENT_ORDER_MONITOR_DB, decodeOrderMonitorDb, isOrderMonitorDb } from "@/lib/admin-order-db"
import { getMarketplacePoolForDb } from "@/lib/mysql-search-analytics"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

const ORDER_MONITOR_MYSQL_ACTIONS = new Set(["getAllOrders", "getOrderMonitorStats", "getOrderDetails"])
const DEFAULT_COMMISSION_RATE = 0.001
const servedQtyColumnCache = new Map<string, boolean>()

type SqlParam = string | number | boolean

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Invalid SQL identifier")
  }
  return `\`${name}\``
}

function paramStr(params: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = params[key]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function sellerDisplayName(row: Record<string, unknown>): string {
  const owner = nz(row.SELLER_OWNER)
  const names = nz(row.SELLER_NAMES)
  return owner || names
}

function isPaidPaymentStatus(paymentStatus: unknown): boolean {
  return nz(paymentStatus).toUpperCase() === "PAID"
}

function sellerFulfillment(orderStatus: string, servedQty: number): string {
  const st = nz(orderStatus).toUpperCase()
  if (st.includes("CANCEL")) return "cancelled"
  if (st.includes("DELIVER") || st.includes("COMPLET")) return "completed"
  if (servedQty > 0) return "seller_serving"
  if (!st || st === "OPEN" || st === "PENDING") return "awaiting_seller"
  return "seller_serving"
}

function asTimestamp(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const iso = v.toISOString()
    return iso.replace("T", " ").replace("Z", "")
  }
  return nz(v)
}

function col(alias: string, name: string): string {
  return alias ? `${alias}.${name}` : name
}

function paidPaymentSql(alias: string): string {
  return `UPPER(TRIM(COALESCE(${col(alias, "PAYMENT_STATUS")},''))) = 'PAID'`
}

function notCancelledSql(alias: string): string {
  return `UPPER(TRIM(COALESCE(${col(alias, "ORDER_STATUS")},''))) != 'CANCELLED'`
}

function openUnpaidSql(alias: string): string {
  return `(${notCancelledSql(alias)} AND NOT (${paidPaymentSql(alias)}))`
}

function needsAttentionSql(alias: string): string {
  return `(
    (UPPER(TRIM(COALESCE(${alias}.PAYMENT_STATUS,''))) = 'PAID'
      AND UPPER(TRIM(COALESCE(${alias}.ORDER_STATUS,''))) = 'OPEN')
    OR TRIM(COALESCE(${alias}.BUYER_PHONE,'')) = ''
    OR UPPER(TRIM(COALESCE(${alias}.BUYER_PHONE,''))) IN ('NA','N/A','NULL')
    OR TRIM(COALESCE(${alias}.BUYER_NAMES,'')) = ''
    OR UPPER(TRIM(COALESCE(${alias}.BUYER_NAMES,''))) IN ('GUEST','NA','N/A')
  )`
}

function completedSql(alias: string): string {
  return `(UPPER(TRIM(COALESCE(${alias}.ORDER_STATUS,''))) LIKE '%DELIVER%'
    OR UPPER(TRIM(COALESCE(${alias}.ORDER_STATUS,''))) LIKE '%COMPLET%')`
}

async function hasConfirmedReceivedQty(pool: Pool, schema: string): Promise<boolean> {
  const cached = servedQtyColumnCache.get(schema)
  if (cached != null) return cached
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_transaction_list'
       AND COLUMN_NAME = 'CONFIRMED_RECEIVED_QTY'
     LIMIT 1`,
    [schema],
  )
  const present = Array.isArray(rows) && rows.length > 0
  servedQtyColumnCache.set(schema, present)
  return present
}

function servedQtySelect(schemaQ: string, hasServed: boolean): string {
  if (!hasServed) return "0 AS served_qty_total"
  return `COALESCE((SELECT SUM(COALESCE(otl.CONFIRMED_RECEIVED_QTY, 0))
    FROM ${schemaQ}.order_transaction_list otl WHERE otl.ID_ORDER = ot.ID_ORDER), 0) AS served_qty_total`
}

function awaitingSellerSql(alias: string, schemaQ: string, hasServed: boolean): string {
  const servedExists = hasServed
    ? `AND NOT EXISTS (
         SELECT 1 FROM ${schemaQ}.order_transaction_list otl
         WHERE otl.ID_ORDER = ${alias}.ID_ORDER
           AND COALESCE(otl.CONFIRMED_RECEIVED_QTY, 0) > 0
       )`
    : ""
  return `(
    UPPER(TRIM(COALESCE(${alias}.ORDER_STATUS,''))) IN ('OPEN','PENDING','')
    ${servedExists}
  )`
}

async function commissionRate(pool: Pool, schemaQ: string): Promise<number> {
  const env = process.env.KAOS_PLATFORM_COMMISSION_RATE?.trim()
  if (env) {
    const v = Number(env)
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v
  }
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rate_decimal FROM ${schemaQ}.ihute_platform_settings
       WHERE setting_key = 'platform_commission_rate' LIMIT 1`,
    )
    const r = num(rows[0]?.rate_decimal)
    if (r > 0) return r
  } catch {
    /* table may not exist on this schema */
  }
  return DEFAULT_COMMISSION_RATE
}

function commissionFields(amount: number, paymentStatus: unknown, rate: number) {
  const eligible = isPaidPaymentStatus(paymentStatus)
  return {
    commissionRate: rate,
    commissionEligible: eligible,
    commissionAmount: eligible ? amount * rate : 0,
  }
}

function mapOrderRow(row: Record<string, unknown>, rate: number) {
  const orderStatus = nz(row.ORDER_STATUS)
  const amount = num(row.AMOUNT)
  const paymentStatus = row.PAYMENT_STATUS
  const servedQty = num(row.served_qty_total)
  return {
    id: num(row.ID_ORDER),
    orderNumber: row.order_number != null ? String(row.order_number) : "",
    sellerName: sellerDisplayName(row),
    sellerOwner: nz(row.SELLER_OWNER),
    sellerIshyigaAccount: nz(row.SELLER_ISHYIGA_ACCOUNT),
    sellerAccount: nz(row.SELLER_ISHYIGA_ACCOUNT),
    sellerPhone: nz(row.SELLER_PHONE),
    buyerName: nz(row.BUYER_NAMES),
    buyerPhone: nz(row.BUYER_PHONE),
    buyerEmail: nz(row.BUYER_EMAIL),
    amount,
    status: orderStatus,
    orderStatus,
    paymentStatus,
    paymentName: row.PAYMENT_NAME,
    paymentId: row.PAYMENT_ID,
    ...commissionFields(amount, paymentStatus, rate),
    timestamp: asTimestamp(row.heure),
    deliveryLocation: row.DELIVERY_LOCATION,
    servedQtyTotal: servedQty,
    servedAmount: 0,
    sellerFulfillment: sellerFulfillment(orderStatus, servedQty),
  }
}

async function getAllOrders(pool: Pool, schema: string, params: Record<string, unknown>) {
  const schemaQ = quoteIdent(schema)
  const hasServed = await hasConfirmedReceivedQty(pool, schema)
  const rate = await commissionRate(pool, schemaQ)
  const sector = paramStr(params, "sector")
  const sellerAccount = paramStr(params, "sellerAccount")
  const status = paramStr(params, "status")
  const paymentStatus = paramStr(params, "paymentStatus")
  const buyerSearch = paramStr(params, "buyerSearch", "search", "q")
  const dateFrom = paramStr(params, "dateFrom")
  const dateTo = paramStr(params, "dateTo")
  const attentionOnly = /^true$/i.test(paramStr(params, "attentionOnly"))
  const fulfillment = paramStr(params, "fulfillment")
  const includeStats = !/^false$/i.test(paramStr(params, "includeStats") || "true")
  const limit = Math.min(200, Math.max(1, Math.trunc(num(params.limit) || 100)))
  const page = Math.max(1, Math.trunc(num(params.page) || 1))

  const conditions: string[] = []
  const sqlParams: SqlParam[] = []

  if (sector) {
    conditions.push(
      `EXISTS (SELECT 1 FROM ${schemaQ}.order_transaction_list otl
        JOIN ${schemaQ}.seller_add_stock s ON otl.ITEM_CODE = s.ITEM_CODE
        WHERE otl.ID_ORDER = ot.ID_ORDER
          AND COALESCE(s.FAMILLE, s.item_department, '') = ?)`,
    )
    sqlParams.push(sector)
  }
  if (sellerAccount) {
    conditions.push("ot.SELLER_ISHYIGA_ACCOUNT = ?")
    sqlParams.push(sellerAccount)
  }
  if (status) {
    conditions.push("UPPER(TRIM(ot.ORDER_STATUS)) = UPPER(TRIM(?))")
    sqlParams.push(status)
  } else {
    conditions.push(notCancelledSql("ot"))
  }
  if (paymentStatus) {
    conditions.push("UPPER(TRIM(COALESCE(ot.PAYMENT_STATUS,''))) = UPPER(TRIM(?))")
    sqlParams.push(paymentStatus)
  }
  if (buyerSearch) {
    const q = buyerSearch.replace(/#/g, " ").trim().replace(/\s+/g, " ")
    const like = `%${q}%`
    const likeLower = `%${q.toLowerCase()}%`
    const numericId = /^\d{1,12}$/.test(q)
    conditions.push(`(
      CAST(ot.ID_ORDER AS CHAR) LIKE ?
      OR LOWER(COALESCE(ot.order_number,'')) LIKE ?
      OR LOWER(COALESCE(ot.BUYER_NAMES,'')) LIKE ?
      OR LOWER(COALESCE(ot.BUYER_OWNER,'')) LIKE ?
      OR LOWER(COALESCE(ot.BUYER_PHONE,'')) LIKE ?
      OR LOWER(COALESCE(ot.BUYER_EMAIL,'')) LIKE ?
      OR LOWER(COALESCE(ot.BUYER_ISHYIGA_ACCOUNT,'')) LIKE ?
      OR LOWER(COALESCE(ot.SELLER_NAMES,'')) LIKE ?
      OR LOWER(COALESCE(ot.SELLER_OWNER,'')) LIKE ?
      OR LOWER(COALESCE(ot.SELLER_ISHYIGA_ACCOUNT,'')) LIKE ?
      OR LOWER(COALESCE(ot.SELLER_PHONE,'')) LIKE ?
      OR LOWER(COALESCE(ot.PAYMENT_ID,'')) LIKE ?
      OR LOWER(COALESCE(ot.PAYMENT_NAME,'')) LIKE ?
      OR LOWER(COALESCE(ot.DELIVERY_LOCATION,'')) LIKE ?
      ${numericId ? "OR ot.ID_ORDER = ?" : ""}
    )`)
    sqlParams.push(like)
    for (let i = 0; i < 13; i++) sqlParams.push(likeLower)
    if (numericId) sqlParams.push(Number(q))
  }
  if (dateFrom) {
    conditions.push("DATE(ot.heure) >= ?")
    sqlParams.push(dateFrom)
  }
  if (dateTo) {
    conditions.push("DATE(ot.heure) <= ?")
    sqlParams.push(dateTo)
  }
  if (attentionOnly) {
    conditions.push(needsAttentionSql("ot"))
  }
  const awaiting = awaitingSellerSql("ot", schemaQ, hasServed)
  if (fulfillment.toLowerCase() === "awaiting_seller") {
    conditions.push(awaiting)
  } else if (fulfillment.toLowerCase() === "completed") {
    conditions.push(completedSql("ot"))
  } else if (fulfillment.toLowerCase() === "seller_serving") {
    conditions.push(`NOT (${awaiting}) AND NOT ${completedSql("ot")} AND ${notCancelledSql("ot")}`)
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""

  const totalsSql = `SELECT
      COALESCE(SUM(ot.AMOUNT), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN ${paidPaymentSql("ot")} THEN ot.AMOUNT * ? ELSE 0 END), 0) AS platformCommission,
      COALESCE(SUM(CASE WHEN ${paidPaymentSql("ot")} THEN ot.AMOUNT ELSE 0 END), 0) AS paidRevenue,
      SUM(CASE WHEN ${paidPaymentSql("ot")} THEN 1 ELSE 0 END) AS paidOrderCount,
      COALESCE(SUM(CASE WHEN ${openUnpaidSql("ot")} THEN ot.AMOUNT ELSE 0 END), 0) AS openRevenue,
      SUM(CASE WHEN ${openUnpaidSql("ot")} THEN 1 ELSE 0 END) AS openOrderCount,
      COUNT(*) AS totalOrders,
      SUM(CASE WHEN ${needsAttentionSql("ot")} THEN 1 ELSE 0 END) AS attentionCount,
      SUM(CASE WHEN ${awaiting} THEN 1 ELSE 0 END) AS awaitingSellerCount,
      SUM(CASE WHEN ${completedSql("ot")} THEN 1 ELSE 0 END) AS completedCount
    FROM ${schemaQ}.order_transaction ot
    ${whereClause}`

  const [totalRows] = await pool.query<RowDataPacket[]>(totalsSql, [rate, ...sqlParams])
  const totals = (totalRows[0] ?? {}) as Record<string, unknown>
  const totalOrders = num(totals.totalOrders)
  const awaitingSellerCount = num(totals.awaitingSellerCount)
  const completedCount = num(totals.completedCount)
  const sellerServingCount = Math.max(0, totalOrders - awaitingSellerCount - completedCount)
  const offset = Math.max(0, (page - 1) * limit)

  const listSql = `SELECT ot.ID_ORDER, ot.order_number, ot.SELLER_NAMES, ot.SELLER_OWNER, ot.SELLER_ISHYIGA_ACCOUNT,
      ot.SELLER_PHONE, ot.BUYER_NAMES, ot.BUYER_PHONE, ot.BUYER_EMAIL,
      ot.AMOUNT, ot.ORDER_STATUS, ot.heure, ot.DELIVERY_LOCATION,
      ot.PAYMENT_STATUS, ot.PAYMENT_NAME, ot.PAYMENT_ID,
      ${servedQtySelect(schemaQ, hasServed)}
    FROM ${schemaQ}.order_transaction ot
    ${whereClause}
    ORDER BY ot.heure DESC
    LIMIT ${limit} OFFSET ${offset}`

  const [listRows] = await pool.query<RowDataPacket[]>(listSql, sqlParams)
  const orders = (Array.isArray(listRows) ? listRows : []).map((row) =>
    mapOrderRow(row as Record<string, unknown>, rate),
  )

  return {
    ok: true,
    db: schema,
    source: `${schema}.order_transaction`,
    itemSource: `${schema}.order_transaction_list`,
    orders,
    totalRevenue: num(totals.totalRevenue),
    platformCommission: num(totals.platformCommission),
    openRevenue: num(totals.openRevenue),
    openOrderCount: num(totals.openOrderCount),
    paidRevenue: num(totals.paidRevenue),
    paidOrderCount: num(totals.paidOrderCount),
    commissionRate: rate,
    totalOrders,
    totalCount: totalOrders,
    currentPage: page,
    pageSize: limit,
    totalPages: totalOrders > 0 ? Math.max(1, Math.ceil(totalOrders / limit)) : 1,
    ...(includeStats
      ? {
          attentionCount: num(totals.attentionCount),
          awaitingSellerCount,
          sellerServingCount,
          completedCount,
        }
      : {}),
  }
}

async function getOrderMonitorStats(pool: Pool, schema: string, params: Record<string, unknown>) {
  const schemaQ = quoteIdent(schema)
  const hasServed = await hasConfirmedReceivedQty(pool, schema)
  let trendDays = Math.trunc(num(params.trendDays) || 14)
  if (trendDays < 7) trendDays = 7
  if (trendDays > 60) trendDays = 60
  const awaiting = awaitingSellerSql("ot", schemaQ, hasServed)

  const [trendRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE(heure) AS d, COUNT(*) AS cnt, COALESCE(SUM(AMOUNT),0) AS gmv
     FROM ${schemaQ}.order_transaction
     WHERE heure >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND ${notCancelledSql("")}
     GROUP BY DATE(heure) ORDER BY d ASC`,
    [trendDays],
  )
  const dailyTrend = (Array.isArray(trendRows) ? trendRows : []).map((row) => ({
    date: nz(row.d),
    orderCount: num(row.cnt),
    gmv: num(row.gmv),
  }))

  const [statusRows] = await pool.execute<RowDataPacket[]>(
    `SELECT UPPER(TRIM(COALESCE(ORDER_STATUS,'UNKNOWN'))) AS label, COUNT(*) AS cnt
     FROM ${schemaQ}.order_transaction
     WHERE heure >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY UPPER(TRIM(COALESCE(ORDER_STATUS,'UNKNOWN'))) ORDER BY cnt DESC LIMIT 12`,
  )
  const statusBreakdown = (Array.isArray(statusRows) ? statusRows : []).map((row) => ({
    label: nz(row.label),
    value: num(row.cnt),
  }))

  const [payRows] = await pool.execute<RowDataPacket[]>(
    `SELECT UPPER(TRIM(COALESCE(NULLIF(PAYMENT_STATUS,''),'UNKNOWN'))) AS label, COUNT(*) AS cnt
     FROM ${schemaQ}.order_transaction
     WHERE heure >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       AND ${notCancelledSql("")}
     GROUP BY UPPER(TRIM(COALESCE(NULLIF(PAYMENT_STATUS,''),'UNKNOWN'))) ORDER BY cnt DESC LIMIT 12`,
  )
  const paymentBreakdown = (Array.isArray(payRows) ? payRows : []).map((row) => ({
    label: nz(row.label),
    value: num(row.cnt),
  }))

  const [topRows] = await pool.execute<RowDataPacket[]>(
    `SELECT SELLER_ISHYIGA_ACCOUNT AS acc,
        COALESCE(NULLIF(TRIM(SELLER_OWNER),''), NULLIF(TRIM(SELLER_NAMES),''), SELLER_ISHYIGA_ACCOUNT) AS name,
        COUNT(*) AS cnt, COALESCE(SUM(AMOUNT),0) AS gmv
     FROM ${schemaQ}.order_transaction
     WHERE heure >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       AND ${notCancelledSql("")}
     GROUP BY SELLER_ISHYIGA_ACCOUNT,
        COALESCE(NULLIF(TRIM(SELLER_OWNER),''), NULLIF(TRIM(SELLER_NAMES),''), SELLER_ISHYIGA_ACCOUNT)
     ORDER BY cnt DESC LIMIT 8`,
  )
  const topSellers = (Array.isArray(topRows) ? topRows : []).map((row) => ({
    sellerAccount: nz(row.acc),
    sellerName: nz(row.name),
    orderCount: num(row.cnt),
    gmv: num(row.gmv),
  }))

  const [kpiRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
        SUM(CASE WHEN ${needsAttentionSql("ot")} THEN 1 ELSE 0 END) AS attentionCount,
        SUM(CASE WHEN UPPER(TRIM(COALESCE(ot.PAYMENT_STATUS,''))) = 'PAID'
          AND UPPER(TRIM(COALESCE(ot.ORDER_STATUS,''))) = 'OPEN' THEN 1 ELSE 0 END) AS paidOpenCount,
        SUM(CASE WHEN DATE(ot.heure) = CURDATE() THEN 1 ELSE 0 END) AS todayOrders,
        COALESCE(SUM(CASE WHEN DATE(ot.heure) = CURDATE() THEN ot.AMOUNT ELSE 0 END),0) AS todayGmv,
        COALESCE(SUM(CASE WHEN ot.heure >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN ot.AMOUNT ELSE 0 END),0) AS gmv30d,
        SUM(CASE WHEN ${awaiting} THEN 1 ELSE 0 END) AS awaitingSellerCount,
        SUM(CASE WHEN ${completedSql("ot")} THEN 1 ELSE 0 END) AS completedCount,
        COUNT(*) AS totalOpenish
     FROM ${schemaQ}.order_transaction ot
     WHERE ${notCancelledSql("ot")}`,
  )
  const kpi = (kpiRows[0] ?? {}) as Record<string, unknown>
  const awaitingSellerCount = num(kpi.awaitingSellerCount)
  const completedCount = num(kpi.completedCount)
  const sellerServingCount = Math.max(0, num(kpi.totalOpenish) - awaitingSellerCount - completedCount)

  return {
    ok: true,
    db: schema,
    source: `${schema}.order_transaction`,
    dailyTrend,
    statusBreakdown,
    paymentBreakdown,
    topSellers,
    fulfillmentBreakdown: [
      { label: "Awaiting seller", value: awaitingSellerCount },
      { label: "Seller serving", value: sellerServingCount },
      { label: "Completed", value: completedCount },
    ],
    attentionCount: num(kpi.attentionCount),
    paidOpenCount: num(kpi.paidOpenCount),
    todayOrders: num(kpi.todayOrders),
    todayGmv: num(kpi.todayGmv),
    gmv30d: num(kpi.gmv30d),
    trendDays,
    awaitingSellerCount,
    sellerServingCount,
    completedCount,
  }
}

async function getOrderDetails(pool: Pool, schema: string, params: Record<string, unknown>) {
  const schemaQ = quoteIdent(schema)
  const hasServed = await hasConfirmedReceivedQty(pool, schema)
  const rate = await commissionRate(pool, schemaQ)
  const orderId = Math.trunc(num(params.orderId))
  if (!orderId) {
    return { ok: false, error: "orderId parameter is required" }
  }

  const [orderRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID_ORDER, order_number, SELLER_ISHYIGA_ACCOUNT, SELLER_NAMES, SELLER_OWNER, SELLER_PHONE,
        BUYER_ISHYIGA_ACCOUNT, BUYER_NAMES, BUYER_PHONE, BUYER_EMAIL, BUYER_OWNER,
        AMOUNT, ORDER_STATUS, heure, DELIVERY_LOCATION, DELIVERY_NAME, DELIVERY_AMOUNT,
        PAYMENT_STATUS, PAYMENT_NAME, PAYMENT_ID
     FROM ${schemaQ}.order_transaction
     WHERE ID_ORDER = ?
     LIMIT 1`,
    [orderId],
  )
  const header = orderRows[0] as Record<string, unknown> | undefined
  if (!header) {
    return { ok: false, error: "Order not found" }
  }

  const servedCol = hasServed ? ", CONFIRMED_RECEIVED_QTY" : ""
  const [itemRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID_LIST, ID_ORDER, ITEM_CODE, ITEM_NAME, QUANTITY, UNITY_PRICE, REQUEST_PRICE
        ${servedCol}
     FROM ${schemaQ}.order_transaction_list
     WHERE ID_ORDER = ?
     ORDER BY ID_LIST`,
    [orderId],
  )

  let servedQtyTotal = 0
  const items = (Array.isArray(itemRows) ? itemRows : []).map((raw) => {
    const row = raw as Record<string, unknown>
    const unity = num(row.UNITY_PRICE)
    const request = num(row.REQUEST_PRICE)
    const qty = num(row.QUANTITY)
    const unitPrice = unity > 0 ? unity : request > 0 ? request : 0
    const servedQty = hasServed ? num(row.CONFIRMED_RECEIVED_QTY) : 0
    servedQtyTotal += servedQty
    return {
      id: num(row.ID_LIST),
      itemCode: nz(row.ITEM_CODE),
      itemName: nz(row.ITEM_NAME),
      quantity: qty,
      unitPrice,
      UNITY_PRICE: unitPrice,
      REQUEST_PRICE: request,
      discountAmount: 0,
      vatRate: 0,
      servedQty,
    }
  })

  const amount = num(header.AMOUNT)
  const orderStatus = nz(header.ORDER_STATUS)
  const paymentStatus = header.PAYMENT_STATUS
  const order = {
    id: num(header.ID_ORDER),
    orderNumber: header.order_number != null ? String(header.order_number) : "",
    sellerAccount: nz(header.SELLER_ISHYIGA_ACCOUNT),
    sellerIshyigaAccount: nz(header.SELLER_ISHYIGA_ACCOUNT),
    sellerName: sellerDisplayName(header),
    sellerOwner: nz(header.SELLER_OWNER),
    sellerPhone: nz(header.SELLER_PHONE),
    buyerAccount: nz(header.BUYER_ISHYIGA_ACCOUNT),
    buyerName: nz(header.BUYER_NAMES),
    buyerPhone: nz(header.BUYER_PHONE),
    buyerEmail: nz(header.BUYER_EMAIL),
    amount,
    taxes: 0,
    deliveryLocation: header.DELIVERY_LOCATION,
    deliveryName: header.DELIVERY_NAME,
    deliveryAmount: num(header.DELIVERY_AMOUNT),
    paymentName: header.PAYMENT_NAME,
    paymentId: header.PAYMENT_ID,
    paymentStatus,
    orderStatus,
    status: orderStatus,
    ...commissionFields(amount, paymentStatus, rate),
    timestamp: asTimestamp(header.heure),
    servedQtyTotal,
    servedAmount: 0,
    db: schema,
    sellerFulfillment: sellerFulfillment(orderStatus, servedQtyTotal),
  }

  return {
    ok: true,
    db: schema,
    source: `${schema}.order_transaction`,
    itemSource: `${schema}.order_transaction_list`,
    order,
    items,
  }
}

export function isClientOrderMonitorRequest(params: Record<string, unknown>): boolean {
  const decoded = decodeOrderMonitorDb(paramStr(params, "db", "database"))
  return decoded === CLIENT_ORDER_MONITOR_DB
}

function getClientOrderMonitorPool(schema: string): Pool | null {
  const existing = getMarketplacePoolForDb(schema)
  if (existing) return existing
  const cfg = getOnboardingMysqlConfig()
  if (!cfg?.host || !cfg.user) return null
  return mysql.createPool({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: schema,
    ...(cfg.port ? { port: cfg.port } : {}),
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
  })
}

export async function tryHandleOrderMonitorMysql(
  action: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!ORDER_MONITOR_MYSQL_ACTIONS.has(action)) return null
  if (!isClientOrderMonitorRequest(params)) return null

  const schema = CLIENT_ORDER_MONITOR_DB
  if (!isOrderMonitorDb(schema)) return null

  const pool = getClientOrderMonitorPool(schema)
  if (!pool) {
    // Let the existing Java AdminServlet path try (now allow-listed for chaos_theta).
    return null
  }

  try {
    if (action === "getAllOrders") return await getAllOrders(pool, schema, params)
    if (action === "getOrderMonitorStats") return await getOrderMonitorStats(pool, schema, params)
    if (action === "getOrderDetails") return await getOrderDetails(pool, schema, params)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin-order-monitor-mysql]", action, message)
    return {
      ok: false,
      error: `Failed to read ${schema}.order_transaction: ${message}`,
      db: schema,
    }
  }
  return null
}
