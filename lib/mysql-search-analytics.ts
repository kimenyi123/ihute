import mysql, { type Pool, type RowDataPacket } from "mysql2/promise"
import { isOrderMonitorDb, type OrderMonitorDb } from "@/lib/admin-order-db"

let pool: Pool | null = null
const poolsByDb = new Map<string, Pool>()

function baseMysqlCreds(): {
  host: string
  user: string
  password: string
  database: string
} | null {
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
  const database =
    process.env.GQ_MYSQL_DATABASE ||
    process.env.ONBOARDING_MYSQL_DATABASE ||
    process.env.FORGOT_PASSWORD_MYSQL_DATABASE ||
    process.env.MYSQL_DATABASE
  if (!host || !user || !database) return null
  const password =
    process.env.GQ_MYSQL_PASSWORD ??
    process.env.ONBOARDING_MYSQL_PASSWORD ??
    process.env.FORGOT_PASSWORD_MYSQL_PASSWORD ??
    process.env.MYSQL_PASSWORD ??
    ""
  return { host, user, password, database }
}

export function getSearchAnalyticsPool(): Pool | null {
  const creds = baseMysqlCreds()
  if (!creds) return null
  if (!pool) {
    pool = mysql.createPool({
      host: creds.host,
      user: creds.user,
      password: creds.password,
      database: creds.database,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    })
  }
  return pool
}

/**
 * Same host/user as search analytics, but connected to an Order Monitor schema
 * (`chaos_beta` / `chaos_test` / `chaos_dev` / `chaos_theta`) — shared picker with /admin/orders.
 */
export function getMarketplacePoolForDb(db: string | null | undefined): Pool | null {
  const creds = baseMysqlCreds()
  if (!creds) return null
  const schema = (db || "").trim().toLowerCase()
  if (!isOrderMonitorDb(schema)) {
    return getSearchAnalyticsPool()
  }
  let p = poolsByDb.get(schema)
  if (!p) {
    p = mysql.createPool({
      host: creds.host,
      user: creds.user,
      password: creds.password,
      database: schema as OrderMonitorDb,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    })
    poolsByDb.set(schema, p)
  }
  return p
}

export function normalizeSearchTerm(term: string): string {
  return (term ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ")
}

export type SearchEventInput = {
  term: string
  source: "shopwithme" | "main_search"
  shop_nickname?: string | null
  results_count: number
  session_id?: string | null
}

export async function recordSearchEvent(input: SearchEventInput): Promise<void> {
  const p = getSearchAnalyticsPool()
  if (!p) return
  const termNorm = normalizeSearchTerm(input.term)
  if (!termNorm) return
  const zero = input.results_count === 0 ? 1 : 0
  await p.execute(
    `INSERT INTO ihute_search_events (search_term, term_norm, source, shop_nickname, results_count, session_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.term.trim(),
      termNorm,
      input.source,
      input.shop_nickname?.trim() || null,
      input.results_count,
      input.session_id?.trim() || null,
    ],
  )
  await p.execute(
    `INSERT INTO ihute_search_term_stats (term_norm, search_count, zero_result_count, last_searched_at)
     VALUES (?, 1, ?, NOW())
     ON DUPLICATE KEY UPDATE
       search_count = search_count + 1,
       zero_result_count = zero_result_count + IF(? = 0, 1, 0),
       last_searched_at = NOW()`,
    [termNorm, zero, input.results_count],
  )
}

export type SearchSelectInput = {
  term: string
  item_code: string
  item_name?: string | null
  source: "shopwithme" | "main_search"
  shop_nickname?: string | null
  session_id?: string | null
}

export async function recordSearchSelection(input: SearchSelectInput): Promise<void> {
  const p = getSearchAnalyticsPool()
  if (!p) return
  const termNorm = normalizeSearchTerm(input.term)
  if (!termNorm || !input.item_code?.trim()) return
  await p.execute(
    `INSERT INTO ihute_search_affinity (term_norm, item_code, item_name, selection_count, affinity_score)
     VALUES (?, ?, ?, 1, 2.0)
     ON DUPLICATE KEY UPDATE
       selection_count = selection_count + 1,
       affinity_score  = affinity_score + 2.0,
       item_name = COALESCE(VALUES(item_name), item_name),
       last_updated    = NOW()`,
    [termNorm, input.item_code.trim(), input.item_name?.trim() || null],
  )
}

export async function fetchSearchInsights(): Promise<{
  top_searches: RowDataPacket[]
  zero_result_searches: RowDataPacket[]
  top_affinity_items: RowDataPacket[]
}> {
  const p = getSearchAnalyticsPool()
  if (!p) {
    return { top_searches: [], zero_result_searches: [], top_affinity_items: [] }
  }
  const [topSearches] = await p.execute<RowDataPacket[]>(
    `SELECT term_norm, search_count, zero_result_count, last_searched_at
     FROM ihute_search_term_stats
     ORDER BY search_count DESC
     LIMIT 20`,
  )
  const [zeroResult] = await p.execute<RowDataPacket[]>(
    `SELECT term_norm, zero_result_count
     FROM ihute_search_term_stats
     WHERE zero_result_count > 0
     ORDER BY zero_result_count DESC
     LIMIT 20`,
  )
  const [topAffinity] = await p.execute<RowDataPacket[]>(
    `SELECT item_code, item_name,
            SUM(affinity_score) AS total_score,
            SUM(selection_count) AS selection_count
     FROM ihute_search_affinity
     GROUP BY item_code, item_name
     ORDER BY total_score DESC
     LIMIT 10`,
  )
  return {
    top_searches: topSearches,
    zero_result_searches: zeroResult,
    top_affinity_items: topAffinity,
  }
}
