import mysql, { type Pool, type RowDataPacket } from "mysql2/promise"

let pool: Pool | null = null

function mysqlConfigured(): boolean {
  const host = process.env.ONBOARDING_MYSQL_HOST || process.env.FORGOT_PASSWORD_MYSQL_HOST
  const user = process.env.ONBOARDING_MYSQL_USER || process.env.FORGOT_PASSWORD_MYSQL_USER
  const database = process.env.ONBOARDING_MYSQL_DATABASE || process.env.FORGOT_PASSWORD_MYSQL_DATABASE
  return Boolean(host && user && database)
}

export function getSearchAnalyticsPool(): Pool | null {
  if (!mysqlConfigured()) return null
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.ONBOARDING_MYSQL_HOST || process.env.FORGOT_PASSWORD_MYSQL_HOST,
      user: process.env.ONBOARDING_MYSQL_USER || process.env.FORGOT_PASSWORD_MYSQL_USER,
      password: process.env.ONBOARDING_MYSQL_PASSWORD ?? process.env.FORGOT_PASSWORD_MYSQL_PASSWORD ?? "",
      database: process.env.ONBOARDING_MYSQL_DATABASE || process.env.FORGOT_PASSWORD_MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    })
  }
  return pool
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
