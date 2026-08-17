/**
 * Grandma shop search against existing Kaos tables (no new table).
 * Uses account_signup geo columns + seller_add_stock prefix/contains LIKE.
 * BOOLEAN FULLTEXT prefixes are not used for retrieval (measured 5–16s).
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
  buildGrandmaPrefixLikePatterns,
  buildGrandmaTypoLikePatterns,
  isRelevantGrandmaSearchHit,
  clampGrandmaSearchQuery,
  type GrandmaSearchParams,
  type GrandmaSearchResult,
  type GrandmaSearchShopHit,
  GRANDMA_SEARCH_DEFAULT_PAGE_SIZE,
  GRANDMA_SEARCH_CANDIDATE_CAP,
  GRANDMA_FULL_SEARCH_MIN_CHARS,
  GRANDMA_SUGGEST_LIMIT,
  GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
} from "@/lib/grandma-search"
import {
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  displayGrandmaShopName,
  grandmaSectorLikePatterns,
  resolveSellerDisplayCategory,
} from "@/lib/seller-category-sector"

let pool: Pool | null = null

export type GrandmaSearchSqlStats = {
  queries: number
  slowestMs: number
  slowestLabel: string
  candidates: number
}

let sqlStats: GrandmaSearchSqlStats = {
  queries: 0,
  slowestMs: 0,
  slowestLabel: "",
  candidates: 0,
}

export function getGrandmaSearchSqlStats(): GrandmaSearchSqlStats {
  return { ...sqlStats }
}

function resetSqlStats() {
  sqlStats = { queries: 0, slowestMs: 0, slowestLabel: "", candidates: 0 }
}

async function trackedQuery(
  p: Pool,
  label: string,
  sql: string,
  binds: unknown[] = [],
): Promise<RowDataPacket[]> {
  sqlStats.queries += 1
  const t0 = Date.now()
  try {
    const [rows] = await p.query<RowDataPacket[]>(sql, binds)
    return rows
  } finally {
    const ms = Date.now() - t0
    if (ms >= sqlStats.slowestMs) {
      sqlStats.slowestMs = ms
      sqlStats.slowestLabel = label
    }
  }
}

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

export type { GrandmaSearchParams, GrandmaSearchResult, GrandmaSearchShopHit } from "@/lib/grandma-search"

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

async function queryProductAccounts(
  p: Pool,
  pats: string[],
  label = "product-like",
): Promise<RowDataPacket[]> {
  if (!pats.length) return []
  const likeOr = pats.map(() => `s.ITEM_NAME LIKE ?`).join(" OR ")
  return trackedQuery(
    p,
    label,
    `SELECT s.SELLER_ISHYIGA_ACCOUNT AS acct, s.ITEM_NAME AS name
     FROM seller_add_stock s
     WHERE s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
       AND (${likeOr})
     LIMIT 400`,
    pats,
  )
}

function longestPrefixPattern(prefixes: string[], fallback: string): string {
  if (!prefixes.length) return fallback
  return prefixes.reduce((best, p) =>
    p.replace(/%/g, "").length > best.replace(/%/g, "").length ? p : best,
  )
}

function mergeProductHits(
  found: Set<string>,
  samples: Map<string, string>,
  rows: RowDataPacket[],
  qRaw = "",
) {
  for (const r of rows) {
    const acct = String(r.acct ?? "").trim()
    const name = String(r.name ?? "").trim()
    if (acct) found.add(acct)
    if (!acct || !name) continue
    const key = acct.toUpperCase()
    const prev = samples.get(key)
    if (!prev) {
      samples.set(key, name)
      continue
    }
    if (!qRaw || prev === name) continue
    const nextScore = rankGrandmaSearchHit(qRaw, { productBlob: name }).score
    const prevScore = rankGrandmaSearchHit(qRaw, { productBlob: prev }).score
    if (nextScore > prevScore) samples.set(key, name)
  }
}

/**
 * Invert product search: longest prefix, then remaining prefixes, then contains, then typo LIKE.
 * BOOLEAN FULLTEXT prefixes (+c* / +cha* / +milk*) are not used — they measured 5–16s.
 */
async function collectTextSearchAccounts(
  p: Pool,
  params: { qRaw: string; likes: string[]; sector: string },
): Promise<{ accounts: string[]; samples: Map<string, string> }> {
  const found = new Set<string>()
  const samples = new Map<string, string>()
  const sector = sectorFilter(params.sector)
  const sectorAnd = sector.sql ? `AND ${sector.sql}` : ""
  const prefixes = buildGrandmaPrefixLikePatterns(params.qRaw).slice(0, 4)
  const fallbackPrefix = `${normalizeSearchText(params.qRaw)}%`
  const shopPrefix = longestPrefixPattern(prefixes, fallbackPrefix)
  const longPrefs = prefixes.filter((p) => p.replace(/%/g, "").length >= 4)
  const shortPrefs = prefixes.filter((p) => p.replace(/%/g, "").length < 4)

  const shopPromise = trackedQuery(
    p,
    "shop-prefix",
    `SELECT a.ISHYIGA_ACCOUNT AS acct
     FROM account_signup a
     WHERE a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'
       ${sectorAnd}
       AND (a.OWNER LIKE ? OR COALESCE(a.nickname,'') LIKE ?)
     LIMIT ${TEXT_CANDIDATE_CAP}`,
    [...sector.binds, shopPrefix, shopPrefix],
  ).catch(() => [] as RowDataPacket[])

  const productPrefixPats = longPrefs.length ? longPrefs : prefixes.length ? prefixes : [shopPrefix]
  const productPrefixPromise = queryProductAccounts(p, productPrefixPats, "product-prefix").catch(
    () => [] as RowDataPacket[],
  )

  const [shopRows, prefixProd] = await Promise.all([shopPromise, productPrefixPromise])
  addAccts(found, shopRows)
  mergeProductHits(found, samples, prefixProd, params.qRaw)

  if (found.size < TEXT_CANDIDATE_CAP && longPrefs.length && shortPrefs.length) {
    try {
      mergeProductHits(
        found,
        samples,
        await queryProductAccounts(p, shortPrefs, "product-prefix-short"),
        params.qRaw,
      )
    } catch {
      /* ignore */
    }
  }

  if (found.size === 0) {
    const likePats = (params.likes.length ? params.likes : [`%${normalizeSearchText(params.qRaw)}%`]).slice(
      0,
      6,
    )
    try {
      mergeProductHits(found, samples, await queryProductAccounts(p, likePats, "product-contains"), params.qRaw)
    } catch {
      /* ignore */
    }
  }

  if (found.size === 0) {
    const typoPats = buildGrandmaTypoLikePatterns(params.qRaw).slice(0, 8)
    try {
      mergeProductHits(found, samples, await queryProductAccounts(p, typoPats, "product-typo"), params.qRaw)
    } catch {
      /* ignore */
    }
  }

  const accounts = [...found].slice(0, TEXT_CANDIDATE_CAP)
  sqlStats.candidates = accounts.length
  return { accounts, samples }
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
  resetSqlStats()
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
  const suggestOnly =
    Boolean(params.suggestOnly) ||
    (Boolean(params.suggest) && qRaw.length > 0 && qRaw.length < GRANDMA_FULL_SEARCH_MIN_CHARS && !nearMe)
  const wantSuggestions = (params.suggest || suggestOnly) && qRaw.length >= 1

  const suggestionsPromise = wantSuggestions ? fetchSuggestions(p, qRaw) : Promise.resolve([] as string[])

  if (suggestOnly || (qRaw.length > 0 && qRaw.length < GRANDMA_FULL_SEARCH_MIN_CHARS && !nearMe)) {
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
      radiusKm: nearMe ? radiusKm : null,
      nearMe,
      emptyReason: null,
    }
  }

  try {
    let accountIds: string[] | undefined
    let productSamplesFromText: Map<string, string> | undefined
    if (qRaw.length >= GRANDMA_FULL_SEARCH_MIN_CHARS) {
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
    const countRows = await trackedQuery(
      p,
      "count-sellers",
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

  const rows = await trackedQuery(p, nearMe ? "list-sellers-nearme" : "list-sellers", listSql, [
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
  const prefixes = buildGrandmaPrefixLikePatterns(qRaw).slice(0, 3)
  const likePrefix = longestPrefixPattern(prefixes, `${q}%`)
  const out = new Set<string>()
  const isValidLabel = (label: string) =>
    Boolean(label) && label.toLowerCase() !== "null" && label.toLowerCase() !== "undefined"

  const shopPromise =
    q.length >= 2
      ? trackedQuery(
          p,
          "suggest-shop",
          `SELECT COALESCE(NULLIF(TRIM(nickname), ''), OWNER) AS label
           FROM account_signup
           WHERE TYPE = 'SELLER' AND STATUS = 'LIVE'
             AND (OWNER LIKE ? OR COALESCE(nickname,'') LIKE ?)
           LIMIT 16`,
          [likePrefix, likePrefix],
        ).catch(() => [] as RowDataPacket[])
      : Promise.resolve([] as RowDataPacket[])

  const prodOr =
    prefixes.length > 0 ? prefixes.map(() => `ITEM_NAME LIKE ?`).join(" OR ") : "ITEM_NAME LIKE ?"
  const prodBinds = prefixes.length ? prefixes : [likePrefix]
  const prodPromise = trackedQuery(
    p,
    "suggest-product",
    `SELECT ITEM_NAME AS label
     FROM seller_add_stock
     WHERE STATUS = 'ACTIVE' AND QUANTITY > 0
       AND (${prodOr})
     LIMIT 24`,
    prodBinds,
  ).catch(() => [] as RowDataPacket[])

  const [shopRows, prodRows] = await Promise.all([shopPromise, prodPromise])
  for (const r of shopRows) {
    const label = String(r.label ?? "").trim()
    if (isValidLabel(label)) out.add(label)
  }
  for (const r of prodRows) {
    const label = String(r.label ?? "").trim()
    if (isValidLabel(label)) out.add(label)
  }
  return [...out].slice(0, GRANDMA_SUGGEST_LIMIT)
}

async function sampleMatchingProductsBatch(
  p: Pool,
  sellerAccounts: string[],
  qRaw: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!sellerAccounts.length) return out
  const prefixes = buildGrandmaPrefixLikePatterns(qRaw).slice(0, 4)
  const likeBinds = prefixes.length
    ? prefixes
    : buildGrandmaSearchLikePatterns(qRaw).slice(0, 4)
  const likes = likeBinds.length
    ? likeBinds
    : [`${normalizeSearchText(qRaw)}%`]
  const placeholders = sellerAccounts.map(() => "?").join(",")
  const orLikes = likes.map(() => `ITEM_NAME LIKE ?`).join(" OR ")
  try {
    const rows = await trackedQuery(
      p,
      "sample-prefix",
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
  const containsPats = buildGrandmaSearchLikePatterns(qRaw).slice(0, 3)
  if (containsPats.length) {
    const containsOr = containsPats.map(() => `ITEM_NAME LIKE ?`).join(" OR ")
    try {
      const containRows = await trackedQuery(
        p,
        "sample-contains",
        `SELECT SELLER_ISHYIGA_ACCOUNT AS acct, ITEM_NAME AS name
         FROM seller_add_stock
         WHERE SELLER_ISHYIGA_ACCOUNT IN (${placeholders})
           AND STATUS = 'ACTIVE' AND QUANTITY > 0
           AND (${containsOr})
         LIMIT 400`,
        [...sellerAccounts, ...containsPats],
      )
      for (const r of containRows) {
        const acct = String(r.acct ?? "").trim().toUpperCase()
        const name = String(r.name ?? "").trim()
        if (acct && name && !out.has(acct)) out.set(acct, name)
      }
    } catch {
      /* ignore */
    }
  }
  if (out.size > 0) return out
  const typoPats = buildGrandmaTypoLikePatterns(qRaw).slice(0, 8)
  if (!typoPats.length) return out
  const typoOr = typoPats.map(() => `ITEM_NAME LIKE ?`).join(" OR ")
  try {
    const typoRows = await trackedQuery(
      p,
      "sample-typo",
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
