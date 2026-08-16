/**
 * Grandma shop search against existing Kaos tables (no new table).
 * Uses account_signup geo columns + seller_add_stock FULLTEXT / LIKE.
 */
import type { Pool, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"
import {
  getOnboardingMysqlConfig,
  toMysqlConnectionOptions,
} from "@/lib/onboarding-mysql"
import { MYSQL_HAVERSINE_KM, isValidLatLng } from "@/lib/geo-haversine"
import {
  normalizeSearchText,
  rankGrandmaSearchHit,
  buildGrandmaSearchLikePatterns,
  buildGrandmaTypoLikePatterns,
  buildGrandmaFulltextBooleanQueries,
  isRelevantGrandmaSearchHit,
  tokenizeSearchQuery,
  clampGrandmaSearchQuery,
  type GrandmaMatchTier,
  type GrandmaSearchHighlight,
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
  GRANDMA_SEARCH_CANDIDATE_CAP,
  GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
} from "@/lib/grandma-search"
import {
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  displayGrandmaShopName,
  grandmaSectorLikePatterns,
  resolveSellerDisplayCategory,
} from "@/lib/seller-category-sector"

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

function guessCategoryLabel(categories: string, department: string, shopName = ""): string {
  return resolveSellerDisplayCategory(categories, department, shopName)
}

type WhereBuilt = { sql: string; binds: unknown[] }

const TEXT_CANDIDATE_CAP = GRANDMA_SEARCH_CANDIDATE_CAP

function sectorFilter(sector: string): WhereBuilt {
  const pats = sector ? grandmaSectorLikePatterns(sector) : []
  if (!pats.length) return { sql: "", binds: [] }
  return {
    sql: `(${pats.map(() => `(a.PREFEREDCATEGORIES LIKE ? OR a.DEPARTMENT LIKE ?)`).join(" OR ")})`,
    binds: pats.flatMap((pat) => [pat, pat]),
  }
}

function addAccts(into: Set<string>, rows: RowDataPacket[]) {
  for (const r of rows) {
    const acct = String(r.acct ?? "").trim()
    if (acct) into.add(acct)
  }
}

/**
 * Invert product search: find matching seller accounts first (FULLTEXT + shop LIKE),
 * then load those rows. Avoids a correlated EXISTS over every LIVE seller's stock.
 */
async function collectTextSearchAccounts(
  p: Pool,
  params: { qRaw: string; likes: string[]; sector: string },
): Promise<{ accounts: string[]; samples: Map<string, string> }> {
  const found = new Set<string>()
  const samples = new Map<string, string>()
  const sector = sectorFilter(params.sector)
  const sectorAnd = sector.sql ? `AND ${sector.sql}` : ""
  const likes = params.likes.length ? params.likes : [`%${normalizeSearchText(params.qRaw)}%`]

  const shopLikes = [likes[0] ?? `%${normalizeSearchText(params.qRaw).replace(/\s+/g, "%")}%`]
  const shopLikeSql = shopLikes
    .map(() => `(LOWER(a.OWNER) LIKE ? OR LOWER(COALESCE(a.nickname,'')) LIKE ?)`)
    .join(" OR ")
  const shopBinds: unknown[] = []
  for (const like of shopLikes) shopBinds.push(like, like)

  const shopPromise = p.query<RowDataPacket[]>(
    `SELECT a.ISHYIGA_ACCOUNT AS acct
     FROM account_signup a
     WHERE a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'
       ${sectorAnd}
       AND (${shopLikeSql})
     LIMIT ${TEXT_CANDIDATE_CAP}`,
    [...sector.binds, ...shopBinds],
  )

  const tokens = tokenizeSearchQuery(params.qRaw)
  const shopShaped = tokens.length >= 2 && tokens.every((t) => t.length >= 5)
  const ftPromise = shopShaped
    ? Promise.resolve({ ok: true, rows: [] as RowDataPacket[] })
    : (async () => {
    const ftQueries = buildGrandmaFulltextBooleanQueries(params.qRaw).slice(0, 3)
    try {
      const parts = await Promise.all(
        ftQueries.map(async (ft) => {
          const [prodRows] = await p.query<RowDataPacket[]>(
            `SELECT s.SELLER_ISHYIGA_ACCOUNT AS acct, MIN(s.ITEM_NAME) AS name
             FROM seller_add_stock s
             WHERE MATCH(s.ITEM_NAME, s.DESCRIPTION_KEYWORD) AGAINST (? IN BOOLEAN MODE)
               AND s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
             GROUP BY s.SELLER_ISHYIGA_ACCOUNT
             LIMIT ${TEXT_CANDIDATE_CAP}`,
            [ft],
          )
          return prodRows
        }),
      )
      return { ok: true, rows: parts.flat() }
    } catch {
      return { ok: false, rows: [] as RowDataPacket[] }
    }
  })()

  const [[shopRows], ftResult] = await Promise.all([shopPromise, ftPromise])
  addAccts(found, shopRows)

  const likelyShopNameQuery =
    found.size > 0 && tokens.length >= 2 && tokens.every((t) => t.length >= 5)

  if (!likelyShopNameQuery) {
    for (const r of ftResult.rows) {
      const acct = String(r.acct ?? "").trim()
      const name = String(r.name ?? "").trim()
      if (acct) found.add(acct)
      if (acct && name && !samples.has(acct.toUpperCase())) samples.set(acct.toUpperCase(), name)
    }
    if (found.size === 0) {
      const likePats = likes.slice(0, 4)
      if (likePats.length) {
        const likeOr = likePats.map(() => `LOWER(s.ITEM_NAME) LIKE ?`).join(" OR ")
        try {
          const [likeRows] = await p.query<RowDataPacket[]>(
            `SELECT s.SELLER_ISHYIGA_ACCOUNT AS acct, MIN(s.ITEM_NAME) AS name
             FROM seller_add_stock s
             WHERE s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
               AND (${likeOr})
             GROUP BY s.SELLER_ISHYIGA_ACCOUNT
             LIMIT ${TEXT_CANDIDATE_CAP}`,
            likePats,
          )
          for (const r of likeRows) {
            const acct = String(r.acct ?? "").trim()
            const name = String(r.name ?? "").trim()
            if (acct) found.add(acct)
            if (acct && name && !samples.has(acct.toUpperCase())) samples.set(acct.toUpperCase(), name)
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (found.size === 0) {
      const typoPats = buildGrandmaTypoLikePatterns(params.qRaw).slice(0, 6)
      if (typoPats.length) {
        const likeOr = typoPats.map(() => `LOWER(s.ITEM_NAME) LIKE ?`).join(" OR ")
        try {
          const [typoRows] = await p.query<RowDataPacket[]>(
            `SELECT s.SELLER_ISHYIGA_ACCOUNT AS acct, MIN(s.ITEM_NAME) AS name
             FROM seller_add_stock s
             WHERE s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
               AND (${likeOr})
             GROUP BY s.SELLER_ISHYIGA_ACCOUNT
             LIMIT ${TEXT_CANDIDATE_CAP}`,
            typoPats,
          )
          for (const r of typoRows) {
            const acct = String(r.acct ?? "").trim()
            const name = String(r.name ?? "").trim()
            if (acct) found.add(acct)
            if (acct && name && !samples.has(acct.toUpperCase())) samples.set(acct.toUpperCase(), name)
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  return { accounts: [...found].slice(0, TEXT_CANDIDATE_CAP), samples }
}

function buildWhere(params: {
  qRaw: string
  sector: string
  nearMe: boolean
  hasGeo: boolean
  lat?: number
  lng?: number
  radiusKm: number | null
  accountIds?: string[]
}): WhereBuilt {
  const where: string[] = [`a.TYPE = 'SELLER'`, `a.STATUS = 'LIVE'`]
  const binds: unknown[] = []

  const sector = sectorFilter(params.sector)
  if (sector.sql) {
    where.push(sector.sql)
    binds.push(...sector.binds)
  }

  if (params.accountIds) {
    if (!params.accountIds.length) {
      where.push("1 = 0")
    } else {
      where.push(`a.ISHYIGA_ACCOUNT IN (${params.accountIds.map(() => "?").join(",")})`)
      binds.push(...params.accountIds)
    }
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
    return { ok: false, error: GRANDMA_PUBLIC_SEARCH_UNAVAILABLE, code: "MYSQL_NOT_CONFIGURED" }
  }

  const qRaw = clampGrandmaSearchQuery(String(params.q ?? "").trim())
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || GRANDMA_SEARCH_DEFAULT_PAGE_SIZE))
  const nearMe = Boolean(params.nearMe)
  const hasGeo = isValidLatLng(params.lat, params.lng)
  const radiusKm =
    params.radiusKm == null || !Number.isFinite(Number(params.radiusKm))
      ? null
      : Math.max(0.1, Number(params.radiusKm))
  const sector = String(params.sector || params.category || "").trim()
  const likes = buildGrandmaSearchLikePatterns(qRaw)

  const suggestionsPromise =
    params.suggest && qRaw.length >= 1 ? fetchSuggestions(p, qRaw) : Promise.resolve([] as string[])

  // Suggestions-only early exit for very short queries without near-me
  if (params.suggest && qRaw.length < 2 && !nearMe) {
    return {
      ok: true,
      source: "mysql",
      query: qRaw,
      shops: [],
      suggestions: await suggestionsPromise,
      page: 1,
      pageSize,
      total: 0,
      hasMore: false,
      radiusKm: null,
      nearMe: false,
      emptyReason: null,
    }
  }

  try {
    let accountIds: string[] | undefined
    let productSamplesFromText: Map<string, string> | undefined
    if (qRaw.length >= 2) {
      const textHits = await collectTextSearchAccounts(p, { qRaw, likes, sector })
      accountIds = textHits.accounts
      productSamplesFromText = textHits.samples
    }
    const suggestions = await suggestionsPromise
    const where = buildWhere({
      qRaw,
      sector,
      nearMe,
      hasGeo,
      lat: params.lat,
      lng: params.lng,
      radiusKm,
      accountIds,
    })
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
      useFulltext: false,
      productSamplesFromText,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn("[grandma-search-mysql] MYSQL_QUERY_FAILED", msg.slice(0, 160))
    return { ok: false, error: GRANDMA_PUBLIC_SEARCH_UNAVAILABLE, code: "MYSQL_QUERY_FAILED" }
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
    productSamplesFromText?: Map<string, string>
  },
): Promise<GrandmaSearchResult> {
  const { where, qRaw, page, pageSize, nearMe, hasGeo, lat, lng, radiusKm, sector, suggestions } =
    ctx

  const offset = (page - 1) * pageSize
  const rankThenPage = qRaw.length >= 2
  const fetchLimit = rankThenPage ? 250 : pageSize
  const fetchOffset = rankThenPage ? 0 : offset

  // Text search already ranks in memory (cap 250). Skip a duplicate COUNT(*) of the
  // same EXISTS/LIKE plan — that second pass was the main 10–30s cost.
  let total = 0
  if (!rankThenPage) {
    const [countRows] = await p.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM account_signup a WHERE ${where.sql}`,
      where.binds,
    )
    total = Number((countRows[0] as { cnt?: number })?.cnt ?? 0)
  }

  const selectDistance = hasGeo ? `, ${MYSQL_HAVERSINE_KM} AS distance_km` : `, NULL AS distance_km`
  const selectBinds: unknown[] = hasGeo ? [lat, lng, lat] : []
  const orderSql =
    nearMe && hasGeo ? `ORDER BY distance_km IS NULL, distance_km ASC, a.OWNER ASC` : `ORDER BY a.OWNER ASC`

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
    fetchLimit,
    fetchOffset,
  ])

  const shops: GrandmaSearchShopHit[] = []
  const accounts = rows
    .map((r) => String(r.sellerAccount ?? "").trim())
    .filter(Boolean)
  const productSamples =
    qRaw.length >= 2 && accounts.length > 0
      ? ctx.productSamplesFromText
        ? ctx.productSamplesFromText
        : await sampleMatchingProductsBatch(p, accounts, qRaw)
      : new Map<string, string>()

  for (const r of rows) {
    const sellerAccount = String(r.sellerAccount ?? "").trim()
    if (!sellerAccount) continue
    const ownerName = String(r.ownerName ?? "").trim()
    const nickname = String(r.nickname ?? "").trim()
    const shopName = displayGrandmaShopName(nickname, ownerName, sellerAccount)
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

    const catLabel = sector ? sectorToCategoryLabel(sector) : guessCategoryLabel(categories, department, shopName)

    if (!isRelevantGrandmaSearchHit(ranked.score, qRaw, ranked.tier)) continue

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

  const visible = rankThenPage ? shops.slice(offset, offset + pageSize) : shops
  const relevantTotal = rankThenPage ? shops.length : total
  const hasMore = rankThenPage
    ? offset + visible.length < shops.length
    : offset + rows.length < total

  let emptyReason: string | null = null
  if (visible.length === 0) {
    if (nearMe && hasGeo && radiusKm != null && qRaw) emptyReason = "no_match_in_radius"
    else if (nearMe && hasGeo && radiusKm != null) emptyReason = "no_shops_in_radius"
    else if (qRaw) emptyReason = "no_text_match"
    else emptyReason = "empty"
  }

  return {
    ok: true,
    source: "mysql",
    query: qRaw,
    shops: visible,
    suggestions,
    page,
    pageSize,
    total: relevantTotal,
    hasMore,
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
    const ft = buildGrandmaFulltextBooleanQueries(qRaw)[0]
    const [prodRows] = await p.query<RowDataPacket[]>(
      ft
        ? `SELECT DISTINCT ITEM_NAME AS label
           FROM seller_add_stock
           WHERE STATUS = 'ACTIVE' AND QUANTITY > 0
             AND MATCH(ITEM_NAME, DESCRIPTION_KEYWORD) AGAINST (? IN BOOLEAN MODE)
           LIMIT 10`
        : `SELECT DISTINCT ITEM_NAME AS label
           FROM seller_add_stock
           WHERE STATUS = 'ACTIVE' AND QUANTITY > 0
             AND LOWER(ITEM_NAME) LIKE ?
           LIMIT 10`,
      [ft || (q.length >= 2 ? likePrefix : contains)],
    )
    for (const r of prodRows) {
      const label = String(r.label ?? "").trim()
      if (label) out.add(label)
    }
  } catch {
    try {
      const [prodRows] = await p.query<RowDataPacket[]>(
        `SELECT DISTINCT ITEM_NAME AS label
         FROM seller_add_stock
         WHERE STATUS = 'ACTIVE' AND QUANTITY > 0
           AND LOWER(ITEM_NAME) LIKE ?
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
  const likeBinds = buildGrandmaSearchLikePatterns(qRaw)
  const likes = likeBinds.length
    ? likeBinds.slice(0, 6)
    : [`%${normalizeSearchText(qRaw).replace(/\s+/g, "%")}%`]
  const placeholders = sellerAccounts.map(() => "?").join(",")
  const ftQs = buildGrandmaFulltextBooleanQueries(qRaw)
  const sampleFt = ftQs[ftQs.length - 1]
  try {
    if (sampleFt) {
      const [ftRows] = await p.query<RowDataPacket[]>(
        `SELECT SELLER_ISHYIGA_ACCOUNT AS acct, ITEM_NAME AS name
         FROM seller_add_stock
         WHERE SELLER_ISHYIGA_ACCOUNT IN (${placeholders})
           AND STATUS = 'ACTIVE' AND QUANTITY > 0
           AND MATCH(ITEM_NAME, DESCRIPTION_KEYWORD) AGAINST (? IN BOOLEAN MODE)
         LIMIT 400`,
        [...sellerAccounts, sampleFt],
      )
      for (const r of ftRows) {
        const acct = String(r.acct ?? "").trim().toUpperCase()
        const name = String(r.name ?? "").trim()
        if (acct && name && !out.has(acct)) out.set(acct, name)
      }
      if (out.size > 0) return out
    }
  } catch {
    /* fall through to ITEM_NAME LIKE on the candidate IN list */
  }
  const orLikes = likes.map(() => `LOWER(ITEM_NAME) LIKE ?`).join(" OR ")
  try {
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT SELLER_ISHYIGA_ACCOUNT AS acct, ITEM_NAME AS name
       FROM seller_add_stock
       WHERE SELLER_ISHYIGA_ACCOUNT IN (${placeholders})
         AND STATUS = 'ACTIVE' AND QUANTITY > 0
         AND (${orLikes})
       LIMIT 400`,
      [...sellerAccounts, ...likes],
    )
    for (const r of rows) {
      const acct = String(r.acct ?? "").trim().toUpperCase()
      const name = String(r.name ?? "").trim()
      if (acct && name && !out.has(acct)) out.set(acct, name)
    }
  } catch {
    /* ignore */
  }
  if (out.size > 0) return out
  const typoPats = buildGrandmaTypoLikePatterns(qRaw).slice(0, 6)
  if (!typoPats.length) return out
  const typoOr = typoPats.map(() => `LOWER(ITEM_NAME) LIKE ?`).join(" OR ")
  try {
    const [typoRows] = await p.query<RowDataPacket[]>(
      `SELECT SELLER_ISHYIGA_ACCOUNT AS acct, ITEM_NAME AS name
       FROM seller_add_stock
       WHERE SELLER_ISHYIGA_ACCOUNT IN (${placeholders})
         AND STATUS = 'ACTIVE' AND QUANTITY > 0
         AND (${typoOr})
       LIMIT 400`,
      [...sellerAccounts, ...typoPats],
    )
    for (const r of typoRows) {
      const acct = String(r.acct ?? "").trim().toUpperCase()
      const name = String(r.name ?? "").trim()
      if (acct && name && !out.has(acct)) out.set(acct, name)
    }
  } catch {
    /* ignore */
  }
  return out
}
