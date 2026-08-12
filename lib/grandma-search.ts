/**
 * Grandma search ranking / normalize / fuzzy helpers (shared client + server).
 */

export type GrandmaMatchTier =
  | "exact"
  | "prefix"
  | "contains"
  | "description"
  | "tags"
  | "fuzzy"
  | "none"

export type GrandmaSearchHighlight = {
  field: string
  snippet: string
}

/** Strip punctuation, collapse whitespace, lowercase. */
export function normalizeSearchText(raw: string): string {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenizeSearchQuery(raw: string): string[] {
  return normalizeSearchText(raw)
    .split(" ")
    .filter((t) => t.length >= 1)
}

/** Levenshtein distance (bounded for short tokens). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return Math.max(m, n)
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

function scoreField(query: string, fieldRaw: string, weights: {
  exact: number
  prefix: number
  contains: number
}): { score: number; tier: GrandmaMatchTier } {
  const field = normalizeSearchText(fieldRaw)
  if (!query || !field) return { score: 0, tier: "none" }
  if (field === query) return { score: weights.exact, tier: "exact" }
  if (field.startsWith(query)) return { score: weights.prefix, tier: "prefix" }
  if (field.includes(query)) return { score: weights.contains, tier: "contains" }

  const tokens = field.split(" ")
  for (const tok of tokens) {
    if (tok === query) return { score: weights.exact - 5, tier: "exact" }
    if (tok.startsWith(query)) return { score: weights.prefix - 5, tier: "prefix" }
    if (query.length >= 3 && tok.length >= 3 && levenshtein(query, tok) <= 1) {
      return { score: Math.max(8, weights.contains - 8), tier: "fuzzy" }
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

/**
 * Rank: exact > prefix > contains > description/tags > fuzzy.
 * Returns score + best tier + highlight snippets.
 */
export function rankGrandmaSearchHit(
  queryRaw: string,
  row: GrandmaRankInput,
): { score: number; tier: GrandmaMatchTier; highlights: GrandmaSearchHighlight[] } {
  const query = normalizeSearchText(queryRaw)
  if (!query) return { score: 0, tier: "none", highlights: [] }

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
    const { score, tier } = scoreField(query, value, weights)
    if (score <= 0) return
    const effectiveTier: GrandmaMatchTier = tierOverride && tier !== "none" ? tierOverride : tier
    if (score > bestScore) {
      bestScore = score
      bestTier = effectiveTier
    }
    highlights.push({
      field,
      snippet: highlightSnippet(value, queryRaw),
    })
  }

  consider("shopName", row.shopName, { exact: 100, prefix: 80, contains: 55 })
  consider("sellerName", row.sellerName, { exact: 95, prefix: 75, contains: 50 })
  consider("brand", row.brand, { exact: 70, prefix: 55, contains: 35 })
  consider("category", row.category, { exact: 60, prefix: 45, contains: 30 })
  consider("description", row.description, { exact: 50, prefix: 40, contains: 25 }, "description")
  consider("tags", row.tags, { exact: 45, prefix: 35, contains: 22 }, "tags")
  consider("product", row.productBlob, { exact: 85, prefix: 65, contains: 40 })

  // Multi-token AND bonus when all tokens appear somewhere in combined haystack
  const tokens = tokenizeSearchQuery(queryRaw)
  if (tokens.length > 1) {
    const hay = normalizeSearchText(
      [row.shopName, row.sellerName, row.description, row.category, row.tags, row.brand, row.productBlob]
        .filter(Boolean)
        .join(" "),
    )
    if (tokens.every((t) => hay.includes(t))) {
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
    // find first token
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

/** Parse `radiusKm` query the same way as GET /api/grandma/search. */
export function parseGrandmaSearchRadiusKm(
  radiusRaw: string | null | undefined,
  defaultKm: number = GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM,
): number | null {
  const raw = String(radiusRaw ?? "").trim()
  if (raw === "" || raw.toLowerCase() === "all") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return defaultKm
  return n
}

export function maxFiniteDistanceKm(distances: Array<number | null | undefined>): number | null {
  let max: number | null = null
  for (const d of distances) {
    if (d == null || !Number.isFinite(d)) continue
    if (max == null || d > max) max = d
  }
  return max
}
