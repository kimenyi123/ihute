import type { RowDataPacket } from "mysql2/promise"
import { getMarketplacePoolForDb, getSearchAnalyticsPool } from "@/lib/mysql-search-analytics"
import type { ShopAnalyticsBundle } from "@/lib/shop-analytics-types"

const SHOP_WITH_ME_ORDER_WHERE = `
  ot.ORDER_STATUS != 'CANCELLED'
  AND (
    COALESCE(ot.IS_TABLE_COMMAND, 0) = 1
    OR ot.DELIVERY_LOCATION LIKE 'Table:%'
    OR ot.DELIVERY_LOCATION LIKE 'table:%'
    OR COALESCE(ot.CONDITIONS, '') LIKE '%IHUTE:shop_with_me%'
  )
`

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type Row = RowDataPacket & Record<string, unknown>

type QueryFn = <T extends Row>(sql: string, params?: unknown[]) => Promise<T[]>

function shopPayloadFilter(nickname: string): { sql: string; params: string[] } {
  if (!nickname) return { sql: "", params: [] }
  return {
    sql: " AND (payload LIKE ? OR payload LIKE ? OR payload LIKE ?)",
    params: [
      `%/shop-with-me/${nickname}%`,
      `%"shopNickname":"${nickname}"%`,
      `%"shopNickname": "${nickname}"%`,
    ],
  }
}

const DEFAULT_RATE = 0.001

async function commissionRate(q: QueryFn): Promise<number> {
  const env = process.env.KAOS_PLATFORM_COMMISSION_RATE?.trim()
  if (env) {
    const v = Number(env)
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v
  }
  const rows = await q<Row>(
    `SELECT rate_decimal FROM ihute_platform_settings WHERE setting_key = 'platform_commission_rate' LIMIT 1`,
  )
  const r = num(rows[0]?.rate_decimal)
  return r > 0 ? r : DEFAULT_RATE
}

export async function fetchShopAnalyticsFromMysql(
  from: string,
  to: string,
  environment: string,
  sellerAccount: string,
  compareCsv: string,
  db = "",
): Promise<ShopAnalyticsBundle> {
  const schema = (db || "").trim()
  const pool = schema ? getMarketplacePoolForDb(schema) : getSearchAnalyticsPool()
  const q: QueryFn = async (sql, params = []) => {
    if (!pool) return []
    const [rows] = await pool.execute(sql, params)
    return rows as never
  }

  const fromTs = `${from} 00:00:00`
  const toTs = `${to} 23:59:59`
  const seller = nz(sellerAccount)
  const sellerSql = seller ? " AND ot.SELLER_ISHYIGA_ACCOUNT = ?" : ""
  const sellerParam = seller ? [seller] : []
  let nickname = ""
  if (seller) {
    const nickRows = await q<Row>(
      `SELECT COALESCE(NULLIF(TRIM(nickname), ''), '') AS n FROM account_seller WHERE ishyiga_account = ? LIMIT 1`,
      [seller],
    )
    nickname = nz(nickRows[0]?.n)
  }
  const envClause = environment ? " AND environment = ?" : ""
  const envParams = environment ? [environment] : []
  const shopFilter = shopPayloadFilter(nickname)

  const productRows = await q<Row>(
    `SELECT otl.ITEM_NAME, otl.ITEM_CODE, otl.NIKI_CODE,
            SUM(COALESCE(otl.QUANTITY, 0)) AS qty_sold,
            COALESCE(SUM(COALESCE(otl.REQUEST_PRICE, otl.UNITY_PRICE * COALESCE(otl.QUANTITY, 0))), 0) AS revenue
     FROM order_transaction_list otl
     JOIN order_transaction ot ON ot.ID_ORDER = otl.ID_ORDER
     WHERE ${SHOP_WITH_ME_ORDER_WHERE}
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     GROUP BY otl.ITEM_NAME, otl.ITEM_CODE, otl.NIKI_CODE
     ORDER BY revenue DESC LIMIT 25`,
    [fromTs, toTs, ...sellerParam],
  )

  const countStage = async (stage: string, shopOnly: boolean) => {
    const rows = await q<Row>(
      `SELECT COUNT(*) AS c FROM activity_events
       WHERE created_at >= ? AND created_at <= ?${envClause}
         AND stage = ?${shopOnly ? " AND (payload LIKE '%/shop-with-me/%' OR payload LIKE '%shopwithme%')" : ""}${shopFilter.sql}`,
      [fromTs, toTs, ...envParams, stage, ...shopFilter.params],
    )
    return num(rows[0]?.c)
  }

  const shopStats = await q<Row>(
    `SELECT COUNT(*) AS order_count, COALESCE(SUM(ot.AMOUNT), 0) AS gmv_total
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?${sellerSql}`,
    [fromTs, toTs, ...sellerParam],
  )
  const paidOrders = num(shopStats[0]?.order_count)
  const gmv = num(shopStats[0]?.gmv_total)
  const shopVisits = await countStage("page_view", true)
  const addToCart = await countStage("add_to_cart", true)
  const checkoutSubmit = await countStage("checkout_submit", true)

  const loyaltyRows = await q<Row>(
    `SELECT COUNT(*) AS cnt,
            SUM(CASE WHEN c = 1 THEN 1 ELSE 0 END) AS one_time,
            SUM(CASE WHEN c > 1 THEN 1 ELSE 0 END) AS repeat_in_period
     FROM (
       SELECT COALESCE(NULLIF(ot.BUYER_ISHYIGA_ACCOUNT,''), ot.BUYER_EMAIL) AS buyer, COUNT(*) AS c
       FROM order_transaction ot
       WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
       GROUP BY buyer
     ) t`,
    [fromTs, toTs, ...sellerParam],
  )

  const heatmapRows = await q<Row>(
    `SELECT DAYOFWEEK(ot.heure) AS dow, HOUR(ot.heure) AS hr,
            COUNT(*) AS order_count, COALESCE(SUM(ot.AMOUNT), 0) AS gmv
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     GROUP BY DAYOFWEEK(ot.heure), HOUR(ot.heure)`,
    [fromTs, toTs, ...sellerParam],
  )

  const channelRows = await q<Row>(
    `SELECT
       SUM(CASE WHEN COALESCE(ot.IS_TABLE_COMMAND, 0) = 1 OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                OR ot.DELIVERY_LOCATION LIKE 'table:%' THEN 1 ELSE 0 END) AS table_orders,
       SUM(CASE WHEN NOT (COALESCE(ot.IS_TABLE_COMMAND, 0) = 1 OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                OR ot.DELIVERY_LOCATION LIKE 'table:%')
                AND COALESCE(ot.CONDITIONS, '') LIKE '%IHUTE:shop_with_me%' THEN 1 ELSE 0 END) AS online_tagged,
       SUM(CASE WHEN NOT (COALESCE(ot.IS_TABLE_COMMAND, 0) = 1 OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                OR ot.DELIVERY_LOCATION LIKE 'table:%')
                AND COALESCE(ot.CONDITIONS, '') NOT LIKE '%IHUTE:shop_with_me%' THEN 1 ELSE 0 END) AS other_shop,
       SUM(CASE WHEN COALESCE(ot.CONDITIONS, '') LIKE '%:qr]%' THEN 1 ELSE 0 END) AS qr_orders,
       SUM(CASE WHEN COALESCE(ot.IS_TABLE_COMMAND, 0) = 1 OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                OR ot.DELIVERY_LOCATION LIKE 'table:%' THEN ot.AMOUNT ELSE 0 END) AS table_gmv,
       SUM(CASE WHEN NOT (COALESCE(ot.IS_TABLE_COMMAND, 0) = 1 OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                OR ot.DELIVERY_LOCATION LIKE 'table:%') THEN ot.AMOUNT ELSE 0 END) AS online_gmv,
       SUM(CASE WHEN COALESCE(ot.CONDITIONS, '') LIKE '%:qr]%' THEN ot.AMOUNT ELSE 0 END) AS qr_gmv
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?${sellerSql}`,
    [fromTs, toTs, ...sellerParam],
  )

  const compareAccounts = compareCsv
    ? compareCsv.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : seller
      ? [seller]
      : []

  const compareSellers = await Promise.all(
    compareAccounts.map(async (acc) => {
      const rows = await q<Row>(
        `SELECT COUNT(*) AS order_count, COALESCE(SUM(ot.AMOUNT), 0) AS gmv_total,
                COUNT(DISTINCT COALESCE(NULLIF(ot.BUYER_ISHYIGA_ACCOUNT,''), ot.BUYER_EMAIL)) AS unique_buyers
         FROM order_transaction ot
         WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?
           AND ot.SELLER_ISHYIGA_ACCOUNT = ?`,
        [fromTs, toTs, acc],
      )
      const nameRows = await q<Row>(
        `SELECT COALESCE(NULLIF(TRIM(owner), ''), '') AS n, COALESCE(NULLIF(TRIM(nickname), ''), '') AS nick
         FROM account_seller WHERE ishyiga_account = ? LIMIT 1`,
        [acc],
      )
      return {
        sellerAccount: acc,
        sellerName: nz(nameRows[0]?.n) || acc,
        shopNickname: nz(nameRows[0]?.nick),
        orderCount: num(rows[0]?.order_count),
        gmvTotal: num(rows[0]?.gmv_total),
        uniqueBuyers: num(rows[0]?.unique_buyers),
        shopPageViews: 0,
      }
    }),
  )

  const rate = await commissionRate(q)
  const commission = gmv * rate

  const searchRows = await q<Row>(
    `SELECT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(payload, '"id":"', -1), '"', 1)) AS term, COUNT(*) AS c
     FROM activity_events
     WHERE stage = 'search' AND created_at >= ? AND created_at <= ?${envClause}
       AND payload LIKE '%"type":"search"%'${shopFilter.sql}
     GROUP BY term HAVING term != '' ORDER BY c DESC LIMIT 20`,
    [fromTs, toTs, ...envParams, ...shopFilter.params],
  )

  const accountingRows = await q<Row>(
    `SELECT ot.ID_ORDER, ot.order_number, ot.heure, ot.AMOUNT, ot.ORDER_STATUS, ot.PAYMENT_STATUS,
            ot.BUYER_NAMES, ot.BUYER_EMAIL, ot.SELLER_NAMES, ot.SELLER_ISHYIGA_ACCOUNT,
            ot.CONDITIONS, ot.DELIVERY_LOCATION,
            COALESCE(s.tin, '') AS seller_tin,
            COALESCE(NULLIF(TRIM(s.momo),''), NULLIF(TRIM(su.momo),''), '') AS seller_momo,
            COALESCE(s.email, '') AS seller_email
     FROM order_transaction ot
     LEFT JOIN account_seller s ON s.ishyiga_account = ot.SELLER_ISHYIGA_ACCOUNT
     LEFT JOIN account_signup su ON su.ISHYIGA_ACCOUNT = ot.SELLER_ISHYIGA_ACCOUNT
     WHERE ${SHOP_WITH_ME_ORDER_WHERE} AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     ORDER BY ot.heure DESC LIMIT 500`,
    [fromTs, toTs, ...sellerParam],
  )

  return {
    topProducts: productRows.map((r) => ({
      itemName: nz(r.ITEM_NAME),
      itemCode: nz(r.ITEM_CODE),
      nikiCode: nz(r.NIKI_CODE),
      quantitySold: num(r.qty_sold),
      revenue: num(r.revenue),
    })),
    funnel: {
      shopVisits,
      addToCart,
      checkoutStarted: await countStage("checkout_step", true),
      checkoutSubmit,
      paidOrders,
      visitToOrderRate: shopVisits > 0 ? Math.round((100 * paidOrders) / shopVisits * 100) / 100 : 0,
    },
    buyerLoyalty: {
      uniqueBuyers: num(loyaltyRows[0]?.cnt),
      oneTimeInPeriod: num(loyaltyRows[0]?.one_time),
      repeatInPeriod: num(loyaltyRows[0]?.repeat_in_period),
      returningFromBefore: 0,
    },
    heatmap: heatmapRows.map((r) => ({
      dayOfWeek: num(r.dow),
      hour: num(r.hr),
      orderCount: num(r.order_count),
      gmv: num(r.gmv),
    })),
    channelSplit: {
      tableOrders: num(channelRows[0]?.table_orders),
      onlineTagged: num(channelRows[0]?.online_tagged),
      otherShop: num(channelRows[0]?.other_shop),
      qrOrders: num(channelRows[0]?.qr_orders),
      tableGmv: num(channelRows[0]?.table_gmv),
      onlineGmv: num(channelRows[0]?.online_gmv),
      qrGmv: num(channelRows[0]?.qr_gmv),
    },
    compareSellers,
    commission: {
      commissionRate: rate,
      commissionRatePercent: Math.round(rate * 100 * 100) / 100,
      gmv,
      platformCommission: Math.round(commission * 100) / 100,
      netPayout: Math.round((gmv - commission) * 100) / 100,
      orderCount: paidOrders,
    },
    cartAbandonment: {
      addToCart,
      checkoutSubmit,
      paidOrders,
      abandonedAfterCart: Math.max(0, addToCart - paidOrders),
      abandonedAfterCheckout: Math.max(0, checkoutSubmit - paidOrders),
      cartAbandonRate: addToCart > 0 ? Math.round((100 * (addToCart - paidOrders)) / addToCart * 100) / 100 : 0,
      checkoutAbandonRate:
        checkoutSubmit > 0 ? Math.round((100 * (checkoutSubmit - paidOrders)) / checkoutSubmit * 100) / 100 : 0,
    },
    searchTerms: searchRows.map((r) => ({ term: nz(r.term), count: num(r.c) })),
    accountingRows: accountingRows.map((r) => ({
      orderId: num(r.ID_ORDER),
      orderNumber: nz(r.order_number),
      timestamp: r.heure ? String(r.heure) : "",
      amount: num(r.AMOUNT),
      orderStatus: nz(r.ORDER_STATUS),
      paymentStatus: nz(r.PAYMENT_STATUS),
      buyerName: nz(r.BUYER_NAMES),
      buyerEmail: nz(r.BUYER_EMAIL),
      sellerName: nz(r.SELLER_NAMES),
      sellerAccount: nz(r.SELLER_ISHYIGA_ACCOUNT),
      sellerTin: nz(r.seller_tin),
      sellerMomo: nz(r.seller_momo),
      sellerEmail: nz(r.seller_email),
      conditions: nz(r.CONDITIONS),
      deliveryLocation: nz(r.DELIVERY_LOCATION),
    })),
  }
}
