/**
 * Grandma shop search against existing Kaos tables (no new table).
 * Uses account_signup geo columns + seller_add_stock FULLTEXT / LIKE.
 */
import type { Pool, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"
import {
  getOnboardingMysqlConfig,
  onboardingMysqlConfigHint,
  toMysqlConnectionOptions,
} from "@/lib/onboarding-mysql"
import { MYSQL_HAVERSINE_KM, isValidLatLng } from "@/lib/geo-haversine"
import {
  normalizeSearchText,
  rankGrandmaSearchHit,
  tokenizeSearchQuery,
  type GrandmaMatchTier,
  type GrandmaSearchHighlight,
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
} from "@/lib/grandma-search"
import { GRANDMA_CATEGORY_TO_SECTOR_SLUG } from "@/lib/seller-category-sector"

let pool: Pool | null = null

function getPool(): Pool | null {
  if (pool) return pool
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) return null
  pool = mysql.createPool({
    ...toMysqlConnectionOptions(cfg),
    waitForConnections: true,
    connectionLimit: 5,
  })
  return pool
}

export type GrandmaSearchShopHit = {
  id: string
  sellerAccount: string
  name: string
  sellerName: string
  category: string
  tagline: string
  description: string
  momo: string
  nickname: string
  latitude: number | null
  longitude: number | null
  distanceKm: number | null
  score: number
  matchTier: GrandmaMatchTier
  highlights: GrandmaSearchHighlight[]
  matchedProductSample?: string
}

export type GrandmaSearchResult = {
  ok: true
  source: "mysql"
  query: string
  shops: GrandmaSearchShopHit[]
  suggestions: string[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  radiusKm: number | null
  nearMe: boolean
  emptyReason: string | null
}

export type GrandmaSearchParams = {
  q?: string
  sector?: string
  category?: string
  lat?: number
  lng?: number
  radiusKm?: number | null
  nearMe?: boolean
  page?: number
  pageSize?: number
  suggest?: boolean
}

function sectorToCategoryLabel(sector: string): string {
  const hit = Object.entries(GRANDMA_CATEGORY_TO_SECTOR_SLUG).find(([, v]) => v === sector)
  return hit?.[0] ?? "Others"
}

function categoryLikePatterns(sectorOrCategory: string): string[] {
  const s = sectorOrCategory.trim().toLowerCase()
  if (!s) return []
  const fromSlug = Object.entries(GRANDMA_CATEGORY_TO_SECTOR_SLUG).find(([, v]) => v === s)
  const label = fromSlug?.[0] ?? (GRANDMA_CATEGORY_TO_SECTOR_SLUG[sectorOrCategory as keyof typeof GRANDMA_CATEGORY_TO_SECTOR_SLUG]
    ? sectorOrCategory
    : sectorToCategoryLabel(s))
  const slug =
    GRANDMA_CATEGORY_TO_SECTOR_SLUG[label as keyof typeof GRANDMA_CATEGORY_TO_SECTOR_SLUG] || s
  const patterns = new Set<string>()
  patterns.add(`%${slug}%`)
  patterns.add(`%${label}%`)
  patterns.add(`%${slug.replace(/-/g, " ")}%`)
  if (slug === "liquor-store") patterns.add("%liquor%")
  if (slug === "coffee-shop") patterns.add("%bakery%")
  if (slug === "restaurant") {
    patterns.add("%restaurant%")
    patterns.add("%bar%")
  }
  return [...patterns]
}

function guessCategoryLabel(categories: string, department: string): string {
  const hay = `${categories} ${department}`.toLowerCase()
  for (const [label, slug] of Object.entries(GRANDMA_CATEGORY_TO_SECTOR_SLUG)) {
    if (hay.includes(slug) || hay.includes(label.toLowerCase())) return label
  }
  return "Others"
}

type WhereBuilt = { sql: string; binds: unknown[] }

function buildWhere(params: {
  qRaw: string
  sector: string
  nearMe: boolean
  hasGeo: boolean
  lat?: number
  lng?: number
  radiusKm: number | null
  useFulltext: boolean
  tokens: string[]
  like: string
}): WhereBuilt {
  const where: string[] = [`a.TYPE = 'SELLER'`, `a.STATUS = 'LIVE'`]
  const binds: unknown[] = []

  if (params.sector) {
    const pats = categoryLikePatterns(params.sector)
    if (pats.length) {
      where.push(
        `(${pats.map(() => `(a.PREFEREDCATEGORIES LIKE ? OR a.DEPARTMENT LIKE ?)`).join(" OR ")})`,
      )
      for (const pat of pats) binds.push(pat, pat)
    }
  }

  if (params.qRaw.length >= 2) {
    const productMatch = params.useFulltext
      ? `(
          MATCH(s.ITEM_NAME, s.DESCRIPTION_KEYWORD) AGAINST (? IN BOOLEAN MODE)
          OR LOWER(s.ITEM_NAME) LIKE ?
          OR LOWER(COALESCE(s.DESCRIPTION,'')) LIKE ?
          OR LOWER(COALESCE(s.DESCRIPTION_KEYWORD,'')) LIKE ?
          OR LOWER(COALESCE(s.FAMILLE,'')) LIKE ?
          OR LOWER(COALESCE(s.item_keywords,'')) LIKE ?
          OR LOWER(COALESCE(s.item_department,'')) LIKE ?
        )`
      : `(
          LOWER(s.ITEM_NAME) LIKE ?
          OR LOWER(COALESCE(s.DESCRIPTION,'')) LIKE ?
          OR LOWER(COALESCE(s.DESCRIPTION_KEYWORD,'')) LIKE ?
          OR LOWER(COALESCE(s.FAMILLE,'')) LIKE ?
          OR LOWER(COALESCE(s.item_keywords,'')) LIKE ?
          OR LOWER(COALESCE(s.item_department,'')) LIKE ?
        )`

    where.push(`(
      LOWER(a.OWNER) LIKE ?
      OR LOWER(COALESCE(a.nickname,'')) LIKE ?
      OR LOWER(COALESCE(a.DESCRIPTION,'')) LIKE ?
      OR LOWER(COALESCE(a.HQ_LOCATION,'')) LIKE ?
      OR LOWER(COALESCE(a.PREFEREDCATEGORIES,'')) LIKE ?
      OR LOWER(COALESCE(a.DEPARTMENT,'')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM seller_add_stock s
        WHERE s.SELLER_ISHYIGA_ACCOUNT = a.ISHYIGA_ACCOUNT
          AND s.STATUS = 'ACTIVE'
          AND s.QUANTITY > 0
          AND ${productMatch}
      )
    )`)

    const lb = params.like
    binds.push(lb, lb, lb, lb, lb, lb)
    if (params.useFulltext) {
      const ft = params.tokens.map((t) => (t.length >= 3 ? `+${t}*` : t)).filter(Boolean).join(" ")
      binds.push(ft || params.qRaw)
    }
    binds.push(lb, lb, lb, lb, lb, lb)
  }

  if (params.nearMe && params.hasGeo) {
    where.push(`a.supplier_latitude IS NOT NULL AND a.supplier_longitude IS NOT NULL`)
    if (params.radiusKm != null) {
      where.push(`${MYSQL_HAVERSINE_KM} <= ?`)
      binds.push(params.lat, params.lng, params.lat, params.radiusKm)
    }
  }

  return { sql: where.join(" AND "), binds }
}

export async function runGrandmaSearch(
  params: GrandmaSearchParams,
): Promise<GrandmaSearchResult | { ok: false; error: string; code: string }> {
  const p = getPool()
  if (!p) {
    return { ok: false, error: onboardingMysqlConfigHint(), code: "MYSQL_NOT_CONFIGURED" }
  }

  const qRaw = String(params.q ?? "").trim()
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || GRANDMA_SEARCH_DEFAULT_PAGE_SIZE))
  const nearMe = Boolean(params.nearMe)
  const hasGeo = isValidLatLng(params.lat, params.lng)
  const radiusKm =
    params.radiusKm == null || !Number.isFinite(Number(params.radiusKm))
      ? null
      : Math.max(0.1, Number(params.radiusKm))
  const sector = String(params.sector || params.category || "").trim()
  const tokens = tokenizeSearchQuery(qRaw)
  const like = `%${normalizeSearchText(qRaw).replace(/\s+/g, "%")}%`
  const useFulltext = normalizeSearchText(qRaw).length >= 3

  let suggestions: string[] = []
  if (params.suggest && qRaw.length >= 1) {
    suggestions = await fetchSuggestions(p, qRaw)
  }

  // Suggestions-only early exit for very short queries without near-me
  if (params.suggest && qRaw.length < 2 && !nearMe) {
    return {
      ok: true,
      source: "mysql",
      query: qRaw,
      shops: [],
      suggestions,
      page: 1,
      pageSize,
      total: 0,
      hasMore: false,
      radiusKm: null,
      nearMe: false,
      emptyReason: null,
    }
  }

  const where = buildWhere({
    qRaw,
    sector,
    nearMe,
    hasGeo,
    lat: params.lat,
    lng: params.lng,
    radiusKm,
    useFulltext,
    tokens,
    like,
  })

  try {
    return await executeSearch(p, {
      where,
      qRaw,
      page,
      pageSize,
      nearMe,
      hasGeo,
      lat: params.lat,
      lng: params.lng,
      radiusKm,
      sector,
      suggestions,
      useFulltext: false, // already embedded in where
    })
  } catch (e) {
    // FULLTEXT can fail on some collations — retry without MATCH
    if (useFulltext && qRaw.length >= 2) {
      const where2 = buildWhere({
        qRaw,
        sector,
        nearMe,
        hasGeo,
        lat: params.lat,
        lng: params.lng,
        radiusKm,
        useFulltext: false,
        tokens,
        like,
      })
      return executeSearch(p, {
        where: where2,
        qRaw,
        page,
        pageSize,
        nearMe,
        hasGeo,
        lat: params.lat,
        lng: params.lng,
        radiusKm,
        sector,
        suggestions,
        useFulltext: false,
      })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, code: "MYSQL_QUERY_FAILED" }
  }
}

async function executeSearch(
  p: Pool,
  ctx: {
    where: WhereBuilt
    qRaw: string
    page: number
    pageSize: number
    nearMe: boolean
    hasGeo: boolean
    lat?: number
    lng?: number
    radiusKm: number | null
    sector: string
    suggestions: string[]
    useFulltext: boolean
  },
): Promise<GrandmaSearchResult> {
  const { where, qRaw, page, pageSize, nearMe, hasGeo, lat, lng, radiusKm, sector, suggestions } =
    ctx

  const [countRows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM account_signup a WHERE ${where.sql}`,
    where.binds,
  )
  const total = Number((countRows[0] as { cnt?: number })?.cnt ?? 0)

  const selectDistance = hasGeo ? `, ${MYSQL_HAVERSINE_KM} AS distance_km` : `, NULL AS distance_km`
  const selectBinds: unknown[] = hasGeo ? [lat, lng, lat] : []

  const orderSql =
    nearMe && hasGeo ? `ORDER BY distance_km IS NULL, distance_km ASC, a.OWNER ASC` : `ORDER BY a.OWNER ASC`

  const offset = (page - 1) * pageSize
  const listSql = `
    SELECT
      a.ISHYIGA_ACCOUNT AS sellerAccount,
      a.OWNER AS ownerName,
      a.nickname AS nickname,
      a.DESCRIPTION AS description,
      a.PREFEREDCATEGORIES AS categories,
      a.DEPARTMENT AS department,
      a.HQ_LOCATION AS hq,
      a.momo AS momo,
      a.supplier_latitude AS latitude,
      a.supplier_longitude AS longitude
      ${selectDistance}
    FROM account_signup a
    WHERE ${where.sql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `

  const [rows] = await p.query<RowDataPacket[]>(listSql, [
    ...selectBinds,
    ...where.binds,
    pageSize,
    offset,
  ])

  const shops: GrandmaSearchShopHit[] = []
  const accounts = rows
    .map((r) => String(r.sellerAccount ?? "").trim())
    .filter(Boolean)
  const productSamples =
    qRaw.length >= 2 && accounts.length > 0
      ? await sampleMatchingProductsBatch(p, accounts, qRaw)
      : new Map<string, string>()

  for (const r of rows) {
    const sellerAccount = String(r.sellerAccount ?? "").trim()
    if (!sellerAccount) continue
    const ownerName = String(r.ownerName ?? "").trim()
    const nickname = String(r.nickname ?? "").trim()
    const shopName = nickname || ownerName || sellerAccount
    const description = String(r.description ?? "").trim()
    const categories = String(r.categories ?? "").trim()
    const department = String(r.department ?? "").trim()
    const productSample = productSamples.get(sellerAccount.toUpperCase()) ?? null

    const ranked = rankGrandmaSearchHit(qRaw || shopName, {
      shopName,
      sellerName: ownerName,
      description,
      category: categories || department,
      tags: [categories, department].filter(Boolean).join(" "),
      brand: nickname,
      productBlob: productSample ?? undefined,
    })

    const la = r.latitude != null ? Number(r.latitude) : null
    const lo = r.longitude != null ? Number(r.longitude) : null
    const distanceKm =
      r.distance_km != null && Number.isFinite(Number(r.distance_km))
        ? Math.round(Number(r.distance_km) * 10) / 10
        : null

    const catLabel = sector ? sectorToCategoryLabel(sector) : guessCategoryLabel(categories, department)

    shops.push({
      id: `supplier_${sellerAccount}__${catLabel.replace(/\s+/g, "_")}`,
      sellerAccount,
      name: shopName,
      sellerName: ownerName,
      category: catLabel,
      tagline: description && description !== "NA" ? description.slice(0, 80) : "Local supplier",
      description,
      momo: r.momo ? `MTN MoMo: ${r.momo}` : "",
      nickname,
      latitude: Number.isFinite(la as number) ? la : null,
      longitude: Number.isFinite(lo as number) ? lo : null,
      distanceKm,
      score: ranked.score,
      matchTier: ranked.tier,
      highlights: ranked.highlights,
      matchedProductSample: productSample ?? undefined,
    })
  }

  if (qRaw.length >= 2) {
    shops.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (nearMe && a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
      return a.name.localeCompare(b.name)
    })
  }

  let emptyReason: string | null = null
  if (shops.length === 0) {
    if (nearMe && hasGeo && radiusKm != null && qRaw) emptyReason = "no_match_in_radius"
    else if (nearMe && hasGeo && radiusKm != null) emptyReason = "no_shops_in_radius"
    else if (qRaw) emptyReason = "no_text_match"
    else emptyReason = "empty"
  }

  return {
    ok: true,
    source: "mysql",
    query: qRaw,
    shops,
    suggestions,
    page,
    pageSize,
    total,
    hasMore: offset + rows.length < total,
    radiusKm: nearMe ? radiusKm : null,
    nearMe,
    emptyReason,
  }
}

async function fetchSuggestions(p: Pool, qRaw: string): Promise<string[]> {
  const q = normalizeSearchText(qRaw)
  if (!q) return []
  const likePrefix = `${q}%`
  const contains = `%${q}%`
  const out = new Set<string>()

  try {
    const [shopRows] = await p.query<RowDataPacket[]>(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(nickname), ''), OWNER) AS label
       FROM account_signup
       WHERE TYPE = 'SELLER' AND STATUS = 'LIVE'
         AND (LOWER(OWNER) LIKE ? OR LOWER(COALESCE(nickname,'')) LIKE ?)
       LIMIT 8`,
      [contains, contains],
    )
    for (const r of shopRows) {
      const label = String(r.label ?? "").trim()
      if (label) out.add(label)
    }
  } catch {
    /* ignore */
  }

  try {
    const [prodRows] = await p.query<RowDataPacket[]>(
      `SELECT DISTINCT ITEM_NAME AS label
       FROM seller_add_stock
       WHERE STATUS = 'ACTIVE' AND QUANTITY > 0
         AND LOWER(ITEM_NAME) LIKE ?
       ORDER BY ITEM_NAME ASC
       LIMIT 10`,
      [q.length >= 2 ? likePrefix : contains],
    )
    for (const r of prodRows) {
      const label = String(r.label ?? "").trim()
      if (label) out.add(label)
    }
  } catch {
    /* ignore */
  }

  return [...out].slice(0, 12)
}

async function sampleMatchingProductsBatch(
  p: Pool,
  sellerAccounts: string[],
  qRaw: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!sellerAccounts.length) return out
  const like = `%${normalizeSearchText(qRaw).replace(/\s+/g, "%")}%`
  const placeholders = sellerAccounts.map(() => "?").join(",")
  try {
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT SELLER_ISHYIGA_ACCOUNT AS acct, ITEM_NAME AS name
       FROM seller_add_stock
       WHERE SELLER_ISHYIGA_ACCOUNT IN (${placeholders})
         AND STATUS = 'ACTIVE' AND QUANTITY > 0
         AND (
           LOWER(ITEM_NAME) LIKE ?
           OR LOWER(COALESCE(DESCRIPTION_KEYWORD,'')) LIKE ?
           OR LOWER(COALESCE(FAMILLE,'')) LIKE ?
         )`,
      [...sellerAccounts, like, like, like],
    )
    for (const r of rows) {
      const acct = String(r.acct ?? "").trim().toUpperCase()
      const name = String(r.name ?? "").trim()
      if (acct && name && !out.has(acct)) out.set(acct, name)
    }
  } catch {
    /* ignore */
  }
  return out
}
