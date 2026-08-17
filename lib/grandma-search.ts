/**
 * Grandma search ranking / normalize / fuzzy helpers (shared client + server).
 *
 * Pipeline: normalize → tokenize → join/collapse variants → candidate patterns
 * → exact/prefix/contains → length-aware Damerau-Levenshtein → synonyms → rank.
 * Does not scan the full catalog; SQL candidate generation stays capped elsewhere.
 */

export type GrandmaMatchTier =
  | "exact"
  | "prefix"
  | "contains"
  | "fuzzy"
  | "synonym"
  | "description"
  | "tags"
  | "none"

export type GrandmaSearchHighlight = {
  field: string
  snippet: string
}

export const GRANDMA_SEARCH_MAX_QUERY_CHARS = 80
export const GRANDMA_SEARCH_MAX_TOKENS = 8
export const GRANDMA_SEARCH_CANDIDATE_CAP = 250
/** Full shop ranking starts here; 1–3 chars stay autocomplete-only unless Near Me. */
export const GRANDMA_FULL_SEARCH_MIN_CHARS = 4
export const GRANDMA_SUGGEST_LIMIT = 8
export const GRANDMA_PUBLIC_SEARCH_UNAVAILABLE =
  "Search is temporarily unavailable. Please try again shortly."
export const GRANDMA_PUBLIC_NEARME_UNAVAILABLE =
  "Location search is temporarily unavailable. Please try again shortly."
export const GRANDMA_PUBLIC_GPS_PERMISSION = "Please allow location access to use Near Me."
export const GRANDMA_PUBLIC_NO_NEARBY = "No shops were found near your current location."
export const GRANDMA_PUBLIC_INVALID_SEARCH = "Please enter a product or shop name."
export const GRANDMA_PUBLIC_INVALID_RADIUS = "Please enter a valid search radius."

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
  source: "mysql" | "java"
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
  /** Prefix autocomplete only — skip ranking and 250-candidate retrieval. */
  suggestOnly?: boolean
}

/** True when a string looks like an internal diagnostic (never show to users). */
export function isTechnicalGrandmaErrorText(raw: string): boolean {
  const t = String(raw || "").toLowerCase()
  if (!t) return false
  return (
    t.includes("mysql") ||
    t.includes("onboarding_") ||
    t.includes("gq_mysql") ||
    t.includes("econnrefused") ||
    t.includes("er_access") ||
    t.includes("sqlstate") ||
    t.includes("jdbc:") ||
    t.includes("ndumiwe") ||
    t.includes(".env") ||
    t.includes("tomcat") ||
    t.includes("pm2") ||
    t.includes("stack") ||
    t.includes("errno") ||
    /\brid\b/.test(t)
  )
}

/** Explicit, testable synonym pairs. Not semantic search. */
export const GRANDMA_SEARCH_SYNONYMS: Record<string, readonly string[]> = {
  milk: ["amata"],
  amata: ["milk"],
  phone: ["mobile", "smartphone"],
  mobile: ["phone", "smartphone"],
  smartphone: ["phone", "mobile"],
  iphone: ["phone"],
  pharmacy: ["pharmacie"],
  pharmacie: ["pharmacy"],
  pharmcie: ["pharmacy", "pharmacie"],
  shoes: ["footwear", "shoe"],
  footwear: ["shoes", "shoe"],
  shoe: ["shoes"],
}

const INCIDENTAL_NEIGHBORS = new Set([
  "body",
  "lotion",
  "shampoo",
  "soap",
  "creme",
  "cream",
  "baby",
  "bebe",
  "cast",
])

/** Strip punctuation, collapse whitespace, lowercase, strip accents. */
export function normalizeSearchText(raw: string): string {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function clampGrandmaSearchQuery(raw: string): string {
  const cut = String(raw || "").slice(0, GRANDMA_SEARCH_MAX_QUERY_CHARS)
  const tokens = tokenizeSearchQuery(cut).slice(0, GRANDMA_SEARCH_MAX_TOKENS)
  return tokens.join(" ")
}

export function tokenizeSearchQuery(raw: string): string[] {
  return normalizeSearchText(raw)
    .split(" ")
    .filter((t) => t.length >= 1)
}

/** Join tokens so "cha pati" can match "chapati". */
export function joinSearchTokens(raw: string): string {
  return tokenizeSearchQuery(raw).join("")
}

/** chappatti / chapatiii → chapati. */
export function collapseRepeatedLetters(raw: string): string {
  return String(raw || "").replace(/(.)\1+/g, "$1")
}

export function synonymsForToken(token: string): string[] {
  const t = normalizeSearchText(token)
  if (!t) return []
  return [...(GRANDMA_SEARCH_SYNONYMS[t] ?? [])]
}

/**
 * Query forms used for ranking and cheap candidate generation (capped).
 * Order: original, joined, collapsed, synonyms — no unbounded edit explosion.
 */
export function grandmaSearchLexemes(qRaw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (s: string) => {
    const t = normalizeSearchText(s)
    if (!t || t.length < 2 || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  const tokens = tokenizeSearchQuery(qRaw)
  const joined = tokens.join("")
  add(normalizeSearchText(qRaw))
  add(joined)
  for (const t of tokens) {
    add(t)
    add(collapseRepeatedLetters(t))
    for (const syn of synonymsForToken(t)) add(syn)
  }
  add(collapseRepeatedLetters(joined))
  return out.slice(0, 12)
}

/**
 * MySQL BOOLEAN MODE queries for candidate retrieval (uses existing
 * FULLTEXT idx_fulltext_product). Stem query is separate so `milkk` still
 * finds `milk` rows without requiring both terms (AND) to be present.
 */
export function buildGrandmaFulltextBooleanQueries(qRaw: string): string[] {
  const tokens = tokenizeSearchQuery(qRaw)
  const out: string[] = []
  const seen = new Set<string>()
  const add = (q: string) => {
    const t = q.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  const primary = tokens.filter((t) => t.length >= 3).map((t) => `+${t}*`).join(" ")
  add(primary)
  const joined = tokens.join("")
  if (joined.length >= 4 && tokens.length >= 2) add(`+${joined}*`)
  for (const t of tokens) {
    const collapsed = collapseRepeatedLetters(t)
    if (collapsed.length >= 4 && collapsed !== t) add(`+${collapsed}*`)
    for (const syn of synonymsForToken(t)) {
      if (syn.length >= 3) add(`+${syn}*`)
    }
  }
  const stems = tokens
    .filter((t) => t.length >= 5)
    .map((t) => t.slice(0, -1))
    .filter((s) => s.length >= 3)
  add([...new Set(stems)].map((s) => `+${s}*`).join(" "))
  return out.slice(0, 5)
}

/** Classic Levenshtein (kept for compatibility). Prefer damerauLevenshtein for typos. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 3) return Math.max(m, n)
  const prev = new Array<number>(n + 1)
  const cur = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]!
  }
  return prev[n]!
}

/** Bounded Damerau-Levenshtein (insert, delete, substitute, adjacent transpose). */
export function damerauLevenshtein(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n > maxDist ? maxDist + 1 : n
  if (!n) return m > maxDist ? maxDist + 1 : m
  if (Math.abs(m - n) > maxDist) return maxDist + 1
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i]![0] = i
  for (let j = 0; j <= n; j++) d[0]![j] = j
  for (let i = 1; i <= m; i++) {
    let rowMin = maxDist + 1
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let val = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, d[i - 2]![j - 2]! + 1)
      }
      d[i]![j] = val
      rowMin = Math.min(rowMin, val)
    }
    if (rowMin > maxDist) return maxDist + 1
  }
  return d[m]![n]!
}

export function maxEditDistanceForLength(len: number): number {
  if (len <= 2) return 0
  if (len <= 5) return 1
  return 2
}

function sharedPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i++
  return i
}

/** Length-aware fuzzy gate. Rejects weak short-token matches. */
export function isStrongFuzzyTokenMatch(query: string, token: string): boolean {
  const q = normalizeSearchText(query)
  const t = normalizeSearchText(token)
  if (!q || !t || q === t) return false
  const minL = Math.min(q.length, t.length)
  const maxL = Math.max(q.length, t.length)
  if (minL <= 2) return false
  const maxD = maxEditDistanceForLength(maxL)
  if (Math.abs(q.length - t.length) > maxD) return false
  const d = damerauLevenshtein(q, t, maxD)
  if (d < 1 || d > maxD) return false
  const sim = 1 - d / maxL
  if (minL === 3) {
    return d === 1 && sharedPrefixLen(q, t) >= 2
  }
  if (d >= 2 && sim < 0.62) return false
  return true
}

function scoreAgainstQueries(
  queries: string[],
  fieldRaw: string,
  weights: { exact: number; prefix: number; contains: number },
): { score: number; tier: GrandmaMatchTier } {
  let best: { score: number; tier: GrandmaMatchTier } = { score: 0, tier: "none" }
  for (const query of queries) {
    const hit = scoreField(query, fieldRaw, weights)
    if (hit.score > best.score) best = hit
  }
  return best
}

function scoreField(
  query: string,
  fieldRaw: string,
  weights: {
    exact: number
    prefix: number
    contains: number
  },
): { score: number; tier: GrandmaMatchTier } {
  const field = normalizeSearchText(fieldRaw)
  if (!query || !field) return { score: 0, tier: "none" }
  if (field === query) return { score: weights.exact, tier: "exact" }

  const tokens = field.split(" ").filter(Boolean)
  for (const tok of tokens) {
    if (tok === query) return { score: weights.exact - 5, tier: "exact" }
  }
  if (field.startsWith(query)) return { score: weights.prefix, tier: "prefix" }
  for (const tok of tokens) {
    if (tok.startsWith(query)) return { score: weights.prefix - 5, tier: "prefix" }
  }
  if (field.includes(query)) return { score: weights.contains, tier: "contains" }

  const syns = synonymsForToken(query)
  for (const syn of syns) {
    if (field === syn || tokens.includes(syn)) {
      return { score: Math.max(34, weights.contains - 4), tier: "synonym" }
    }
  }

  for (const tok of tokens) {
    if (isStrongFuzzyTokenMatch(query, tok)) {
      const d = damerauLevenshtein(query, tok, 3)
      const fuzzyScore = Math.max(12, weights.contains - 6 - d * 3)
      return { score: fuzzyScore, tier: "fuzzy" }
    }
  }
  return { score: 0, tier: "none" }
}

export type GrandmaRankInput = {
  shopName?: string
  sellerName?: string
  description?: string
  category?: string
  tags?: string
  brand?: string
  productBlob?: string
}

const TIER_RANK: Record<GrandmaMatchTier, number> = {
  exact: 70,
  prefix: 60,
  contains: 50,
  fuzzy: 40,
  synonym: 35,
  description: 20,
  tags: 15,
  none: 0,
}

/**
 * Rank: exact > prefix > contains > strong fuzzy > synonym > description/tags.
 */
export function rankGrandmaSearchHit(
  queryRaw: string,
  row: GrandmaRankInput,
): { score: number; tier: GrandmaMatchTier; highlights: GrandmaSearchHighlight[] } {
  const query = normalizeSearchText(queryRaw)
  if (!query) return { score: 0, tier: "none", highlights: [] }

  const queries = grandmaSearchLexemes(queryRaw)
  const highlights: GrandmaSearchHighlight[] = []
  let bestScore = 0
  let bestTier: GrandmaMatchTier = "none"

  const consider = (
    field: string,
    value: string | undefined,
    weights: { exact: number; prefix: number; contains: number },
    tierOverride?: GrandmaMatchTier,
  ) => {
    if (!value) return
    const { score, tier } = scoreAgainstQueries(queries, value, weights)
    if (score <= 0) return
    const effectiveTier: GrandmaMatchTier = tierOverride && tier !== "none" ? tierOverride : tier
    let nextScore = score
    if (field === "product" && value) {
      const hay = normalizeSearchText(value).split(" ")
      const qTok = tokenizeSearchQuery(queryRaw)
      const incidental = qTok.some(
        (qt) => hay.includes(qt) && hay.some((h) => INCIDENTAL_NEIGHBORS.has(h)),
      )
      if (incidental) nextScore = Math.max(GRANDMA_SEARCH_MIN_SCORE, nextScore - 12)
    }
    if (
      nextScore > bestScore ||
      (nextScore === bestScore && TIER_RANK[effectiveTier] > TIER_RANK[bestTier])
    ) {
      bestScore = nextScore
      bestTier = effectiveTier
    }
    highlights.push({
      field,
      snippet: highlightSnippet(value, queryRaw),
    })
  }

  consider("product", row.productBlob, { exact: 100, prefix: 82, contains: 55 })
  consider("shopName", row.shopName, { exact: 90, prefix: 70, contains: 45 })
  consider("sellerName", row.sellerName, { exact: 86, prefix: 66, contains: 42 })
  consider("brand", row.brand, { exact: 70, prefix: 55, contains: 35 })
  consider("category", row.category, { exact: 55, prefix: 40, contains: 28 })
  consider("description", row.description, { exact: 45, prefix: 32, contains: 18 }, "description")
  consider("tags", row.tags, { exact: 40, prefix: 28, contains: 16 }, "tags")

  const tokens = tokenizeSearchQuery(queryRaw)
  if (tokens.length > 1) {
    const hay = normalizeSearchText(
      [row.shopName, row.sellerName, row.description, row.category, row.tags, row.brand, row.productBlob]
        .filter(Boolean)
        .join(" "),
    )
    const joined = tokens.join("")
    if (tokens.every((t) => hay.includes(t)) || hay.includes(joined)) {
      bestScore += 12
    }
  }

  return { score: bestScore, tier: bestTier, highlights: highlights.slice(0, 4) }
}

/** Wrap first match in «» markers for UI (client converts to <mark>). */
export function highlightSnippet(text: string, queryRaw: string, maxLen = 80): string {
  const raw = String(text || "").trim()
  if (!raw) return ""
  const q = normalizeSearchText(queryRaw)
  if (!q) return raw.slice(0, maxLen)
  const lower = raw.toLowerCase()
  const normRaw = normalizeSearchText(raw)
  let idx = lower.indexOf(queryRaw.trim().toLowerCase())
  if (idx < 0) {
    const tok = tokenizeSearchQuery(queryRaw)[0]
    if (tok) idx = lower.indexOf(tok)
  }
  if (idx < 0 && normRaw.includes(q)) {
    idx = Math.max(0, Math.floor(raw.length / 4))
  }
  if (idx < 0) return raw.slice(0, maxLen)

  const start = Math.max(0, idx - 12)
  const end = Math.min(raw.length, idx + queryRaw.trim().length + 40)
  let snip = raw.slice(start, end)
  if (start > 0) snip = "…" + snip
  if (end < raw.length) snip = snip + "…"

  const re = new RegExp(`(${escapeRegExp(queryRaw.trim().split(/\s+/)[0] || q)})`, "ig")
  return snip.replace(re, "«$1»")
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Convert «match» markers to HTML mark tags (safe text already escaped by React if split). */
export function splitHighlightMarkers(snippet: string): Array<{ text: string; hit: boolean }> {
  const parts: Array<{ text: string; hit: boolean }> = []
  const re = /«([^»]+)»/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(snippet))) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), hit: false })
    parts.push({ text: m[1]!, hit: true })
    last = m.index + m[0].length
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), hit: false })
  return parts.length ? parts : [{ text: snippet, hit: false }]
}

export const GRANDMA_NEAR_ME_RADIUS_OPTIONS_KM = [1, 5, 10, 25, 50] as const
export const GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM = 1
export const GRANDMA_SEARCH_DEFAULT_PAGE_SIZE = 30
/** Drop SQL hits whose only match is a weak description/tag substring. */
export const GRANDMA_SEARCH_MIN_SCORE = 30

export function isRelevantGrandmaSearchHit(
  score: number,
  queryRaw: string,
  tier: GrandmaMatchTier = "none",
): boolean {
  const q = normalizeSearchText(queryRaw)
  if (!q) return true
  if (q.length <= 2) return tier === "exact" && score >= GRANDMA_SEARCH_MIN_SCORE
  if (score < GRANDMA_SEARCH_MIN_SCORE) return false
  if (tier === "description" || tier === "tags" || tier === "none") return false
  return true
}

/** Small slack so float Haversine values on the boundary are not dropped. */
export const GRANDMA_NEAR_ME_RADIUS_EPSILON_KM = 0.05

/**
 * Client + server-side Near Me radius gate.
 * - nearMe off → keep all
 * - radiusKm null ("All") → keep all (including shops without coordinates)
 * - radius set → keep only shops with a finite distance within the radius
 */
export function shopWithinNearMeRadius(
  distanceKm: number | null | undefined,
  opts: { nearMe: boolean; radiusKm: number | null },
): boolean {
  if (!opts.nearMe || opts.radiusKm == null) return true
  if (distanceKm == null || !Number.isFinite(distanceKm)) return false
  return distanceKm <= opts.radiusKm + GRANDMA_NEAR_ME_RADIUS_EPSILON_KM
}

/**
 * Parse `radiusKm` the same way as GET /api/grandma/search.
 * - `all` → no distance cap (null)
 * - omitted / empty → official default (1 km)
 * - invalid / ≤0 → official default (1 km)
 */
export function parseGrandmaSearchRadiusKm(
  radiusRaw: string | null | undefined,
  defaultKm: number = GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM,
): number | null {
  const raw = String(radiusRaw ?? "").trim()
  if (raw.toLowerCase() === "all") return null
  if (raw === "") return defaultKm
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return defaultKm
  return n
}

/** API-layer check: empty/all/valid number OK; junk and ≤0 are 400. */
export function grandmaSearchRadiusParamError(raw: string | null | undefined): "INVALID_RADIUS" | null {
  if (raw == null) return null
  const t = raw.trim()
  if (t === "" || t.toLowerCase() === "all") return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return "INVALID_RADIUS"
  return null
}

/**
 * SQL LIKE patterns for cheap (phase-1) Grandma text search.
 * Includes normalized query, joined tokens, collapsed repeats, trailing stem, synonyms.
 */
export function buildGrandmaSearchLikePatterns(qRaw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (p: string) => {
    if (!p || seen.has(p)) return
    seen.add(p)
    out.push(p)
  }
  const norm = normalizeSearchText(qRaw)
  if (norm) add(`%${norm.replace(/\s+/g, "%")}%`)
  const joined = joinSearchTokens(qRaw)
  if (joined.length >= 4) add(`%${joined}%`)
  for (const t of tokenizeSearchQuery(qRaw)) {
    const collapsed = collapseRepeatedLetters(t)
    if (collapsed.length >= 4 && collapsed !== t) add(`%${collapsed}%`)
    if (t.length >= 4) {
      const stem = t.slice(0, -1)
      if (stem.length >= 3) add(`%${stem}%`)
    }
    if (t.length >= 5) add(`%${t.slice(0, 4)}%`)
    if (t.length >= 6) add(`%${t.slice(0, 5)}%`)
    if (t.length >= 5 && t.length <= 8 && collapsed === t) {
      for (let i = t.length - 2; i >= 2 && out.length < 6; i--) {
        add(`%${t.slice(0, i)}_${t.slice(i)}%`)
      }
    }
    for (const syn of synonymsForToken(t)) {
      if (syn.length >= 3) add(`%${syn}%`)
    }
  }
  return out.slice(0, 6)
}

/**
 * Prefix LIKE cores (`query%`) for autocomplete and first-pass retrieval.
 * Avoids leading-wildcard `%query%` so MySQL can use a range scan when collation allows.
 */
export function buildGrandmaPrefixLikePatterns(qRaw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (core: string) => {
    const t = normalizeSearchText(core)
    if (!t) return
    const p = `${t}%`
    if (seen.has(p)) return
    seen.add(p)
    out.push(p)
  }
  for (const lex of grandmaSearchLexemes(qRaw)) add(lex)
  const joined = joinSearchTokens(qRaw)
  if (joined.length >= 3) add(joined)
  add(collapseRepeatedLetters(normalizeSearchText(qRaw)))
  return out.slice(0, 6)
}

/**
 * Phase-2 LIKE patterns used only when phase-1 retrieval is empty.
 * Bounded transpositions, deletions, and one-character insertion wildcards.
 */
export function buildGrandmaTypoLikePatterns(qRaw: string): string[] {
  const MAX = 16
  const MIN_CORE = 4
  const seeds: string[] = []
  const seenSeed = new Set<string>()
  const addSeed = (s: string) => {
    const t = normalizeSearchText(s)
    if (!t || t.length < MIN_CORE || t.length > 24 || seenSeed.has(t)) return
    seenSeed.add(t)
    seeds.push(t)
  }
  for (const t of tokenizeSearchQuery(qRaw)) addSeed(t)
  addSeed(joinSearchTokens(qRaw))
  for (const t of [...seeds]) addSeed(collapseRepeatedLetters(t))

  const out: string[] = []
  const seen = new Set<string>()
  const add = (core: string) => {
    if (core.length < MIN_CORE || core.length > 26) return
    const p = `%${core}%`
    if (seen.has(p)) return
    seen.add(p)
    out.push(p)
  }

  for (const t of seeds) {
    if (out.length >= MAX) break
    for (let i = 0; i < t.length - 1 && out.length < MAX; i++) {
      if (t[i] === t[i + 1]) continue
      add(t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2))
    }
    if (t.length >= 5) {
      for (let i = 0; i < t.length && out.length < MAX; i++) {
        add(t.slice(0, i) + t.slice(i + 1))
      }
    }
    if (t.length >= 5 && t.length <= 16) {
      for (let i = 1; i < t.length && out.length < MAX; i++) {
        add(t.slice(0, i) + "_" + t.slice(i))
      }
    }
  }
  return out.slice(0, MAX)
}

export function maxFiniteDistanceKm(distances: Array<number | null | undefined>): number | null {
  let max: number | null = null
  for (const d of distances) {
    if (d == null || !Number.isFinite(d)) continue
    if (max == null || d > max) max = d
  }
  return max
}
