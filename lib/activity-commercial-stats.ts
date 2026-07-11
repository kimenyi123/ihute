import type { RowDataPacket } from "mysql2/promise"
import { getSearchAnalyticsPool } from "@/lib/mysql-search-analytics"
import { fetchShopAnalyticsFromMysql } from "@/lib/shop-analytics-mysql"

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

function shopNicknameFromConditions(conditions: string): string {
  const m = conditions.match(/\[IHUTE:shop_with_me:([^\]]+)\]/)
  if (!m) return ""
  const raw = m[1].trim()
  if (!raw || raw === "table" || raw === "qr") return ""
  const head = raw.split(":")[0]?.trim() || ""
  if (!head || head === "table") return ""
  return head.toLowerCase()
}

function conditionsFromQr(conditions: string): boolean {
  const c = conditions.toLowerCase()
  return c.includes(":qr]") || c.includes('"fromqr":true') || c.includes('"acquisitionsource":"qr"')
}

function fmtRwf(n: number): string {
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(Math.round(n))
}

type Row = RowDataPacket & Record<string, unknown>

async function q<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getSearchAnalyticsPool()
  if (!pool) return []
  const [rows] = await pool.execute<T[]>(sql, params)
  return rows
}

export async function fetchCommercialStatsFromMysql(
  from: string,
  to: string,
  environment = "",
  sellerAccount = "",
  compareSellers = "",
): Promise<Record<string, unknown> | null> {
  const pool = getSearchAnalyticsPool()
  if (!pool || !nz(from) || !nz(to)) return null

  const fromTs = `${from} 00:00:00`
  const toTs = `${to} 23:59:59`
  const seller = nz(sellerAccount)
  const hasRange = Boolean(nz(from) && nz(to))
  const sellerSql = seller ? " AND ot.SELLER_ISHYIGA_ACCOUNT = ?" : ""
  const sellerParam = seller ? [seller] : []

  const envClause = environment ? " AND environment = ?" : ""
  const envParams = environment ? [environment] : []

  const stageRows = await q<Row>(
    `SELECT stage, COUNT(*) AS c
     FROM activity_events
     WHERE created_at >= ? AND created_at <= ?${envClause}
     GROUP BY stage`,
    [fromTs, toTs, ...envParams],
  )

  const engagement: Record<string, number | string> = {
    pageViews: 0,
    uniqueSessions: 0,
    sessionStarts: 0,
    searches: 0,
    productViews: 0,
    addToCart: 0,
    checkouts: 0,
    logins: 0,
    source: "mysql",
  }
  for (const row of stageRows) {
    const stage = nz(row.stage)
    const c = num(row.c)
    if (stage === "page_view") engagement.pageViews = c
    else if (stage === "session_start") engagement.sessionStarts = c
    else if (stage === "search") engagement.searches = c
    else if (stage === "product_view") engagement.productViews = c
    else if (stage === "add_to_cart") engagement.addToCart = c
    else if (stage === "checkout_submit") engagement.checkouts = c
    else if (stage === "auth") engagement.logins = c
  }

  const sessionRows = await q<Row>(
    `SELECT COUNT(DISTINCT session_id) AS c
     FROM activity_events
     WHERE created_at >= ? AND created_at <= ?${envClause}
       AND session_id IS NOT NULL AND session_id != ''`,
    [fromTs, toTs, ...envParams],
  )
  engagement.uniqueSessions = num(sessionRows[0]?.c)

  const orderRows = await q<Row>(
    `SELECT COUNT(*) AS order_count,
            COALESCE(SUM(AMOUNT), 0) AS gmv_total,
            COALESCE(MIN(AMOUNT), 0) AS gmv_min,
            COALESCE(MAX(AMOUNT), 0) AS gmv_max,
            COALESCE(AVG(AMOUNT), 0) AS gmv_avg,
            COUNT(DISTINCT COALESCE(NULLIF(BUYER_ISHYIGA_ACCOUNT,''), BUYER_EMAIL)) AS unique_buyers,
            COUNT(DISTINCT SELLER_ISHYIGA_ACCOUNT) AS active_sellers
     FROM order_transaction ot
     WHERE ot.ORDER_STATUS != 'CANCELLED'
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}`,
    [fromTs, toTs, ...sellerParam],
  )
  const o = orderRows[0] || {}
  const orders = {
    orderCount: num(o.order_count),
    gmvTotal: num(o.gmv_total),
    gmvMin: num(o.gmv_min),
    gmvMax: num(o.gmv_max),
    gmvAvg: num(o.gmv_avg),
    uniqueBuyers: num(o.unique_buyers),
    activeSellers: num(o.active_sellers),
  }

  const shopRows = await q<Row>(
    `SELECT COUNT(*) AS order_count,
            COALESCE(SUM(ot.AMOUNT), 0) AS gmv_total,
            COUNT(DISTINCT COALESCE(NULLIF(ot.BUYER_ISHYIGA_ACCOUNT,''), ot.BUYER_EMAIL)) AS unique_buyers,
            COUNT(DISTINCT ot.SELLER_ISHYIGA_ACCOUNT) AS active_sellers,
            SUM(CASE WHEN COALESCE(ot.IS_TABLE_COMMAND, 0) = 1
                      OR ot.DELIVERY_LOCATION LIKE 'Table:%'
                      OR ot.DELIVERY_LOCATION LIKE 'table:%' THEN 1 ELSE 0 END) AS table_orders,
            SUM(CASE WHEN COALESCE(ot.CONDITIONS, '') LIKE '%IHUTE:shop_with_me%' THEN 1 ELSE 0 END) AS tagged_orders
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE}
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}`,
    [fromTs, toTs, ...sellerParam],
  )
  const s = shopRows[0] || {}

  let shopPageViews = 0
  if (seller) {
    const nickRows = await q<Row>(
      `SELECT COALESCE(NULLIF(TRIM(nickname), ''), '') AS shop_nickname
       FROM account_seller WHERE ishyiga_account = ? LIMIT 1`,
      [seller],
    )
    const nickname = nz(nickRows[0]?.shop_nickname)
    if (nickname) {
      const shopPageViewRows = await q<Row>(
        `SELECT COUNT(*) AS c
         FROM activity_events
         WHERE created_at >= ? AND created_at <= ?${envClause}
           AND stage = 'page_view'
           AND (payload LIKE '%/shop-with-me/%' OR payload LIKE '%shopwithme%' OR payload LIKE '%shop-with-me?%')
           AND (payload LIKE ? OR payload LIKE ? OR payload LIKE ? OR payload LIKE ?)`,
        [
          fromTs,
          toTs,
          ...envParams,
          `%/shop-with-me/${nickname}%`,
          `%nickname=${nickname}%`,
          `%"shopNickname":"${nickname}"%`,
          `%"shopNickname": "${nickname}"%`,
        ],
      )
      shopPageViews = num(shopPageViewRows[0]?.c)
    }
  } else {
    const shopPageViewRows = await q<Row>(
      `SELECT COUNT(*) AS c
       FROM activity_events
       WHERE created_at >= ? AND created_at <= ?${envClause}
         AND stage = 'page_view'
         AND (payload LIKE '%/shop-with-me/%' OR payload LIKE '%shopwithme%' OR payload LIKE '%shop-with-me?%')`,
      [fromTs, toTs, ...envParams],
    )
    shopPageViews = num(shopPageViewRows[0]?.c)
  }

  const qrStageRows = await q<Row>(
    seller
      ? `SELECT ae.stage, COUNT(*) AS c
         FROM activity_events ae
         JOIN account_seller a ON a.ishyiga_account = ?
         WHERE ae.created_at >= ? AND ae.created_at <= ?${envClause}
           AND ae.stage IN ('qr_share','qr_scan')
           AND (
             ae.payload LIKE CONCAT('%"shopNickname":"', COALESCE(NULLIF(TRIM(a.nickname), ''), '__none__'), '"%')
             OR ae.payload LIKE CONCAT('%/shop-with-me/', COALESCE(NULLIF(TRIM(a.nickname), ''), '__none__), '%')
           )
         GROUP BY ae.stage`
      : `SELECT stage, COUNT(*) AS c
         FROM activity_events
         WHERE created_at >= ? AND created_at <= ?${envClause}
           AND stage IN ('qr_share','qr_scan')
         GROUP BY stage`,
    seller ? [seller, fromTs, toTs, ...envParams] : [fromTs, toTs, ...envParams],
  )
  let qrShares = 0
  let qrScans = 0
  for (const row of qrStageRows) {
    if (nz(row.stage) === "qr_share") qrShares = num(row.c)
    if (nz(row.stage) === "qr_scan") qrScans = num(row.c)
  }

  const qrOrderRows = await q<Row>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(ot.AMOUNT), 0) AS gmv
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE}
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
       AND COALESCE(ot.CONDITIONS, '') LIKE '%:qr]%'`,
    [fromTs, toTs, ...sellerParam],
  )

  const shopWithMe = {
    orderCount: num(s.order_count),
    gmvTotal: num(s.gmv_total),
    uniqueBuyers: num(s.unique_buyers),
    activeSellers: seller ? (num(s.order_count) > 0 ? 1 : 0) : num(s.active_sellers),
    tableOrders: num(s.table_orders),
    taggedOrders: num(s.tagged_orders),
    shopPageViews,
    qrShares,
    qrScans,
    qrOrders: num(qrOrderRows[0]?.c),
    qrGmv: num(qrOrderRows[0]?.gmv),
    ...(seller ? { sellerAccount: seller } : {}),
  }

  const dailyEngagement = await q<Row>(
    `SELECT DATE(created_at) AS stat_date,
            SUM(CASE WHEN stage = 'page_view' THEN 1 ELSE 0 END) AS page_views,
            SUM(CASE WHEN stage = 'search' THEN 1 ELSE 0 END) AS searches,
            SUM(CASE WHEN stage = 'product_view' THEN 1 ELSE 0 END) AS product_views,
            SUM(CASE WHEN stage = 'add_to_cart' THEN 1 ELSE 0 END) AS add_to_cart,
            SUM(CASE WHEN stage = 'checkout_submit' THEN 1 ELSE 0 END) AS checkouts,
            SUM(CASE WHEN stage = 'auth' THEN 1 ELSE 0 END) AS logins
     FROM activity_events
     WHERE created_at >= ? AND created_at <= ?${envClause}
     GROUP BY DATE(created_at)
     ORDER BY stat_date ASC`,
    [fromTs, toTs, ...envParams],
  )

  const dailyOrders = await q<Row>(
    `SELECT DATE(ot.heure) AS stat_date,
            COUNT(*) AS orders,
            COALESCE(SUM(ot.AMOUNT), 0) AS gmv
     FROM order_transaction ot
     WHERE ot.ORDER_STATUS != 'CANCELLED'
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     GROUP BY DATE(ot.heure)
     ORDER BY stat_date ASC`,
    [fromTs, toTs, ...sellerParam],
  )

  const dailyShopOrders = await q<Row>(
    `SELECT DATE(ot.heure) AS stat_date,
            COUNT(*) AS swm_orders,
            COALESCE(SUM(ot.AMOUNT), 0) AS swm_gmv
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE}
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     GROUP BY DATE(ot.heure)
     ORDER BY stat_date ASC`,
    [fromTs, toTs, ...sellerParam],
  )

  const byDate = new Map<string, Record<string, unknown>>()
  for (const row of dailyEngagement) {
    const date = String(row.stat_date).slice(0, 10)
    byDate.set(date, {
      date,
      pageViews: num(row.page_views),
      searches: num(row.searches),
      productViews: num(row.product_views),
      addToCart: num(row.add_to_cart),
      checkouts: num(row.checkouts),
      logins: num(row.logins),
      orders: 0,
      gmv: 0,
      shopWithMeOrders: 0,
      shopWithMeGmv: 0,
    })
  }
  for (const row of dailyOrders) {
    const date = String(row.stat_date).slice(0, 10)
    const day = byDate.get(date) || { date, pageViews: 0, searches: 0, productViews: 0 }
    day.orders = num(row.orders)
    day.gmv = num(row.gmv)
    byDate.set(date, day)
  }
  for (const row of dailyShopOrders) {
    const date = String(row.stat_date).slice(0, 10)
    const day = byDate.get(date) || { date }
    day.shopWithMeOrders = num(row.swm_orders)
    day.shopWithMeGmv = num(row.swm_gmv)
    byDate.set(date, day)
  }
  const daily = Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  )

  const recentRows = await q<Row>(
    `SELECT ot.ID_ORDER, ot.order_number, ot.SELLER_NAMES, ot.SELLER_ISHYIGA_ACCOUNT,
            ot.BUYER_NAMES, ot.AMOUNT, ot.ORDER_STATUS, ot.PAYMENT_STATUS, ot.heure,
            ot.DELIVERY_LOCATION, ot.IS_TABLE_COMMAND, ot.TABLE_NAME, ot.CONDITIONS
     FROM order_transaction ot
     WHERE ${SHOP_WITH_ME_ORDER_WHERE}
       AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
     ORDER BY ot.heure DESC
     LIMIT 100`,
    [fromTs, toTs, ...sellerParam],
  )

  const topShopSql = seller
    ? `SELECT ot.SELLER_ISHYIGA_ACCOUNT,
              MAX(ot.SELLER_NAMES) AS seller_name,
              COUNT(*) AS order_count,
              COALESCE(SUM(ot.AMOUNT), 0) AS gmv
       FROM order_transaction ot
       WHERE ${SHOP_WITH_ME_ORDER_WHERE}
         AND ot.heure >= ? AND ot.heure <= ?${sellerSql}
       GROUP BY ot.SELLER_ISHYIGA_ACCOUNT
       ORDER BY gmv DESC
       LIMIT 1`
    : `SELECT ot.SELLER_ISHYIGA_ACCOUNT,
              MAX(ot.SELLER_NAMES) AS seller_name,
              COUNT(*) AS order_count,
              COALESCE(SUM(ot.AMOUNT), 0) AS gmv
       FROM order_transaction ot
       WHERE ${SHOP_WITH_ME_ORDER_WHERE}
         AND ot.heure >= ? AND ot.heure <= ?
       GROUP BY ot.SELLER_ISHYIGA_ACCOUNT
       ORDER BY gmv DESC
       LIMIT 10`

  const topShopRows = await q<Row>(topShopSql, seller ? [fromTs, toTs, ...sellerParam] : [fromTs, toTs])

  const recentShopWithMeOrders = recentRows.map((row) => {
    const conditions = nz(row.CONDITIONS)
    return {
      orderId: num(row.ID_ORDER),
      orderNumber: nz(row.order_number),
      sellerName: nz(row.SELLER_NAMES),
      sellerAccount: nz(row.SELLER_ISHYIGA_ACCOUNT),
      buyerName: nz(row.BUYER_NAMES),
      amount: num(row.AMOUNT),
      status: nz(row.ORDER_STATUS),
      paymentStatus: nz(row.PAYMENT_STATUS),
      timestamp: row.heure ? String(row.heure) : "",
      deliveryLocation: nz(row.DELIVERY_LOCATION),
      isTableCommand: num(row.IS_TABLE_COMMAND) === 1,
      tableName: nz(row.TABLE_NAME),
      shopNickname: shopNicknameFromConditions(conditions),
      fromQr: conditionsFromQr(conditions),
      conditions,
    }
  })

  // Most shared / scanned QRs (activity events + QR-attributed orders)
  const qrEventRows = await q<Row>(
    `SELECT payload, stage
     FROM activity_events
     WHERE created_at >= ? AND created_at <= ?${envClause}
       AND stage IN ('qr_share','qr_scan')
     ORDER BY created_at DESC
     LIMIT 5000`,
    [fromTs, toTs, ...envParams],
  )
  const qrByNick = new Map<string, { shareCount: number; scanCount: number; qrOrderCount: number }>()
  for (const row of qrEventRows) {
    const payload = nz(row.payload)
    const nickMatch = payload.match(/"shopNickname"\s*:\s*"([^"]+)"/i)
    const pathMatch = payload.match(/\/shop-with-me\/([^/? "'\\]+)/i)
    const nick = (nickMatch?.[1] || pathMatch?.[1] || "").trim().toLowerCase()
    if (!nick) continue
    const cur = qrByNick.get(nick) || { shareCount: 0, scanCount: 0, qrOrderCount: 0 }
    if (nz(row.stage) === "qr_share") cur.shareCount += 1
    else cur.scanCount += 1
    qrByNick.set(nick, cur)
  }
  for (const row of recentRows) {
    const conditions = nz(row.CONDITIONS)
    if (!conditionsFromQr(conditions)) continue
    const nick = shopNicknameFromConditions(conditions)
    if (!nick) continue
    const cur = qrByNick.get(nick) || { shareCount: 0, scanCount: 0, qrOrderCount: 0 }
    cur.qrOrderCount += 1
    qrByNick.set(nick, cur)
  }
  const nickList = Array.from(qrByNick.keys())
  const nickSellerRows =
    nickList.length > 0
      ? await q<Row>(
          `SELECT LOWER(TRIM(nickname)) AS nick, ishyiga_account,
                  COALESCE(NULLIF(TRIM(OWNER), ''),
                    TRIM(CONCAT(COALESCE(FIRSTNAME, ''), ' ', COALESCE(LASTNAME, '')))) AS seller_name
           FROM account_seller
           WHERE LOWER(TRIM(nickname)) IN (${nickList.map(() => "?").join(",")})`,
          nickList,
        )
      : []
  const nickMeta = new Map(
    nickSellerRows.map((r) => [
      nz(r.nick),
      { sellerAccount: nz(r.ishyiga_account), sellerName: nz(r.seller_name) },
    ]),
  )
  let topQrShares = Array.from(qrByNick.entries())
    .map(([shopNickname, counts]) => ({
      shopNickname,
      ...counts,
      sellerAccount: nickMeta.get(shopNickname)?.sellerAccount || "",
      sellerName: nickMeta.get(shopNickname)?.sellerName || "",
    }))
    .sort(
      (a, b) =>
        b.shareCount + b.scanCount * 2 + b.qrOrderCount * 3 - (a.shareCount + a.scanCount * 2 + a.qrOrderCount * 3),
    )
    .slice(0, seller ? 5 : 15)
  if (seller) {
    const sellerNickRows = await q<Row>(
      `SELECT COALESCE(NULLIF(TRIM(nickname), ''), '') AS shop_nickname
       FROM account_seller WHERE ishyiga_account = ? LIMIT 1`,
      [seller],
    )
    const sn = nz(sellerNickRows[0]?.shop_nickname).toLowerCase()
    if (sn) topQrShares = topQrShares.filter((r) => r.shopNickname === sn)
  }

  const sellerOptionRows = await q<Row>(
    hasRange
      ? `SELECT a.ISHYIGA_ACCOUNT AS seller_account,
                COALESCE(NULLIF(TRIM(a.OWNER), ''),
                  TRIM(CONCAT(COALESCE(a.FIRSTNAME, ''), ' ', COALESCE(a.LASTNAME, '')))) AS seller_name,
                COALESCE(NULLIF(TRIM(a.nickname), ''), '') AS shop_nickname,
                COALESCE(s.order_count, 0) AS order_count,
                COALESCE(s.gmv, 0) AS gmv
         FROM account_seller a
         LEFT JOIN (
           SELECT ot.SELLER_ISHYIGA_ACCOUNT, COUNT(*) AS order_count,
                  COALESCE(SUM(ot.AMOUNT), 0) AS gmv
           FROM order_transaction ot
           WHERE ${SHOP_WITH_ME_ORDER_WHERE}
             AND ot.heure >= ? AND ot.heure <= ?
           GROUP BY ot.SELLER_ISHYIGA_ACCOUNT
         ) s ON s.SELLER_ISHYIGA_ACCOUNT = a.ISHYIGA_ACCOUNT
         WHERE a.STATUS = 'LIVE'
         ORDER BY COALESCE(s.order_count, 0) DESC, seller_name ASC`
      : `SELECT a.ISHYIGA_ACCOUNT AS seller_account,
                COALESCE(NULLIF(TRIM(a.OWNER), ''),
                  TRIM(CONCAT(COALESCE(a.FIRSTNAME, ''), ' ', COALESCE(a.LASTNAME, '')))) AS seller_name,
                COALESCE(NULLIF(TRIM(a.nickname), ''), '') AS shop_nickname,
                0 AS order_count, 0 AS gmv
         FROM account_seller a
         WHERE a.STATUS = 'LIVE'
         ORDER BY seller_name ASC`,
    hasRange ? [fromTs, toTs] : [],
  )

  const topShopWithMeShops = topShopRows.map((row) => ({
    sellerAccount: nz(row.SELLER_ISHYIGA_ACCOUNT),
    sellerName: nz(row.seller_name),
    orderCount: num(row.order_count),
    gmv: num(row.gmv),
  }))

  const sessions =
    num(engagement.uniqueSessions) > 0 ? num(engagement.uniqueSessions) : num(engagement.sessionStarts)

  const pitchSummary = `IHUTE ${from} to ${to}: ${num(engagement.pageViews).toLocaleString()} page views, ${sessions.toLocaleString()} sessions, ${orders.orderCount.toLocaleString()} total orders (${fmtRwf(orders.gmvTotal)} RWF GMV). Shop-with-me: ${shopWithMe.orderCount.toLocaleString()} orders (${fmtRwf(shopWithMe.gmvTotal)} RWF), ${shopWithMe.shopPageViews.toLocaleString()} shop page views, ${shopWithMe.activeSellers} active shop sellers.`

  const analytics = await fetchShopAnalyticsFromMysql(from, to, environment, seller, compareSellers)

  return {
    ok: true,
    currency: "RWF",
    sellerAccount: seller,
    engagement,
    orders,
    shopWithMe,
    daily,
    recentShopWithMeOrders,
    topShopWithMeShops,
    topQrShares,
    sellerOptions: sellerOptionRows.map((row) => ({
      sellerAccount: nz(row.seller_account),
      sellerName: nz(row.seller_name),
      shopNickname: nz(row.shop_nickname),
      orderCount: num(row.order_count),
      gmv: num(row.gmv),
    })),
    pitchSummary,
    analytics,
    source: "mysql",
  }
}
