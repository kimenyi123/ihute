/**
 * Fetch search suggestion terms (recent + popular) from API.
 * No hardcoded lists — all from backend or local search history.
 */
import { getRecentSearches } from "./search-intent-tracker"
import { getTopSearchIntents } from "./search-intent-tracker"

const MAX_SUGGESTIONS = 12

/**
 * Returns suggestion terms to show when search box is empty.
 * Uses recent searches first, then top intents; dedupes and limits.
 */
export async function fetchSearchSuggestions(limit: number = MAX_SUGGESTIONS): Promise<string[]> {
  const [recent, topIntents] = await Promise.all([
    getRecentSearches(limit),
    getTopSearchIntents(limit).catch(() => []),
  ])

  const seen = new Set<string>()
  const out: string[] = []

  for (const term of recent) {
    const t = term.trim()
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  for (const item of topIntents) {
    const t = (typeof item === "string" ? item : (item?.keyword ?? "")).trim()
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }

  return out.slice(0, limit)
}
