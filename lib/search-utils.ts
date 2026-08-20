// lib/search-utils.ts
/**
 * Search Utility Functions
 * Provides client-side relevance filtering for more accurate search results
 * Includes multilingual keyword matching (English, Kinyarwanda, French)
 */

import { expandSearchQuery, getTranslations } from './keyword-mapping'

/**
 * Calculate relevance score for a search match
 * Higher score = more relevant
 * Now includes multilingual keyword expansion
 */
export function calculateRelevanceScore(
  searchQuery: string,
  targetText: string,
  options: {
    exactMatchBonus?: number
    startsWithBonus?: number
    containsBonus?: number
    wordBoundaryBonus?: number
    translationBonus?: number
  } = {}
): number {
  const {
    exactMatchBonus = 100,
    startsWithBonus = 50,
    containsBonus = 20, // Increased to help partial supplier name matches
    wordBoundaryBonus = 30,
    translationBonus = 40 // Bonus for matching translations
  } = options

  const query = searchQuery.toLowerCase().trim()
  const target = targetText.toLowerCase().trim()

  if (!query || !target) return 0

  // Get expanded search terms (includes translations)
  const expandedTerms = expandSearchQuery(query)
  let maxScore = 0

  // Check each expanded term (original + translations)
  expandedTerms.forEach((term, index) => {
    const normalizedTerm = term.toLowerCase().trim()
    let score = 0

    // Exact match - highest relevance
    if (target === normalizedTerm) {
      score = exactMatchBonus
    }
    // Starts with query - very relevant
    else if (target.startsWith(normalizedTerm)) {
      score = startsWithBonus
    }
    // Word boundary match (e.g., "insta" matches "INSTA SHOP" but not "fanta")
    else if (new RegExp(`\\b${escapeRegex(normalizedTerm)}`, 'i').test(target)) {
      score = wordBoundaryBonus
    }
    // Contains query - somewhat relevant
    else if (target.includes(normalizedTerm)) {
      score = containsBonus
    }
    // Check if all words in query are present in target
    else {
      const queryWords = normalizedTerm.split(/\s+/)
      const allWordsPresent = queryWords.every(word => target.includes(word))
      if (allWordsPresent && queryWords.length > 1) {
        score = containsBonus * 0.8
      }
    }

    // If this is a translation (not the original term), apply translation bonus
    if (index > 0 && score > 0) {
      score = Math.min(score + translationBonus, exactMatchBonus)
    }

    maxScore = Math.max(maxScore, score)
  })

  return maxScore
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split query on spaces into tokens for AND matching.
 * - Pure digits: keep from length 1 (e.g. "500")
 * - Text: min length 2 (drops stray single letters)
 * - Recipe measures (cup, tsp, …) are dropped so "½ CUP ALMONDS" can match shelf "ALMONDS"
 */
const MEASURE_TOKENS = new Set([
  "cup", "cups", "tsp", "tbsp", "tablespoon", "teaspoon", "ounce", "ounces", "oz",
  "gram", "grams", "kg", "ml", "liter", "litre", "ltr", "pinch", "dash", "half",
  "quarter", "clove", "cloves", "slice", "slices", "can", "cans", "pack", "packet",
])

export function tokenizeSearchQueryForAnd(query: string): string[] {
  const raw = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  return raw.filter((t) => {
    if (MEASURE_TOKENS.has(t)) return false
    // Unicode fractions / single glyphs
    if (t.length === 1 && !/^\d$/.test(t)) return false
    if (/^\d+$/.test(t)) return t.length >= 1
    return t.length >= 2
  })
}

/** Combined text used to test whether each token matches a product */
export function getProductSearchBlob<T extends {
  item_commercial_name?: string
  item_key_words?: string
  item_key_words_kinyarwanda?: string
  item_key_words_french?: string
  item_french?: string
  IMITERERE?: string
  keywords_en?: string
  item_code?: string
  supplier_name?: string
  item_packet?: string | number
  item_emballage?: string
  item_inn?: string
  niki_item_key_words?: string
}>(product: T): string {
  const q = product as Record<string, unknown>
  return [
    product.item_commercial_name,
    q.item_name,
    q.ITEM_NAME,
    q.name,
    product.item_key_words,
    q.item_keywords,
    q.ITEM_KEYWORDS,
    q.ITEM_KEY_WORDS,
    q.niki_code,
    q.NIKI_CODE,
    q.nikiCode,
    q.nikicode,
    q.CODE_ISHYIGA,
    q.code_ishyiga,
    product.item_key_words_kinyarwanda,
    product.IMITERERE,
    q.IMITERERE,
    product.keywords_en,
    q.keywords_en,
    product.item_key_words_french,
    product.item_french,
    q.item_french,
    product.item_inn,
    product.niki_item_key_words,
    product.item_code,
    q.ITEM_CODE,
    q.product_code,
    q.productCode,
    q.code,
    product.supplier_name,
    product.item_packet != null ? String(product.item_packet) : undefined,
    product.item_emballage,
    q.item_description ?? q.description ?? "",
    q.item_fabricant ?? q.brand ?? q.BRAND ?? "",
    q.famille ?? q.FAMILLE ?? "",
    q.item_department ?? q.DEPARTMENT ?? "",
    q.category ?? q.CATEGORY ?? "",
    q.item_state ?? q.ITEM_STATE ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/**
 * One token must appear in the blob. Numeric tokens use digit boundaries so
 * "500" matches "500ml" but not "1500".
 * Includes multilingual translations (e.g. amazi -> water, inzoga -> beer).
 */
function stemVariants(token: string): string[] {
  const t = token.toLowerCase()
  if (!t) return []
  const out = new Set<string>([t])
  if (t.length >= 5 && t.endsWith("s") && !t.endsWith("ss")) {
    out.add(t.slice(0, -1))
  }
  return Array.from(out)
}

export function tokenMatchesInSearchBlob(token: string, blob: string): boolean {
  const t = token.toLowerCase().trim()
  if (!t || !blob) return false
  if (/^\d+$/.test(t)) {
    const re = new RegExp(`(?<!\\d)${escapeRegex(t)}(?!\\d)`, "i")
    return re.test(blob)
  }
  const expanded = expandSearchQuery(t)
  const variants = Array.from(new Set<string>([...stemVariants(t), ...expanded]))
  for (const v of variants) {
    if (v && blob.includes(v.toLowerCase())) return true
  }
  return false
}

/** Every token must match somewhere in the blob (logical AND across tokens). */
export function productMatchesAllSearchTokens<T extends {
  item_commercial_name?: string
  item_key_words?: string
  item_code?: string
  supplier_name?: string
  item_packet?: string | number
  item_emballage?: string
}>(product: T, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const blob = getProductSearchBlob(product)
  return tokens.every((tok) => tokenMatchesInSearchBlob(tok, blob))
}

/**
 * Filter suppliers by relevance score
 * Only returns suppliers with high relevance scores
 * Uses stricter matching to avoid unrelated results
 * Now with logging support
 */
export function filterSuppliersByRelevance<T extends { supplier_name: string }>(
  suppliers: T[],
  searchQuery: string,
  minScore: number = 3 // Lowered default from 5 to 3 - more inclusive
): (T & { finalScore: number })[] {
  if (!suppliers || suppliers.length === 0) {
    return []
  }

  if (!searchQuery.trim()) return suppliers.map(s => ({ ...s, finalScore: 0 }))

  const query = searchQuery.trim().toLowerCase()
  const terms = query.split(/\s+/).filter(t => t.length >= 2)

  console.log(`[SupplierFilter] Filtering ${suppliers.length} suppliers with ${terms.length} terms for query: "${searchQuery}"`)

  const scoredSuppliers = suppliers.map(supplier => {
    // Use multilingual matching from calculateRelevanceScore
    const score = calculateRelevanceScore(searchQuery, supplier.supplier_name)
    return { ...supplier, finalScore: score }
  })

  // Filter out low-scoring results - only keep word boundary matches or better
  const filtered = scoredSuppliers.filter(item => item.finalScore >= minScore)
  const sorted = filtered.sort((a, b) => b.finalScore - a.finalScore)

  console.log(`[SupplierFilter] Kept ${sorted.length}/${suppliers.length} suppliers with score >= ${minScore}`)
  if (sorted.length > 0) {
    console.log(`[SupplierFilter] Top 3 scores:`, sorted.slice(0, 3).map(s => ({
      name: s.supplier_name,
      score: s.finalScore
    })))
  } else if (suppliers.length > 0 && filtered.length === 0) {
    // Log filtered-out suppliers for debugging
    console.warn(`[SupplierFilter] All ${suppliers.length} suppliers filtered out. Top 3 scores:`, 
      scoredSuppliers.sort((a, b) => b.finalScore - a.finalScore).slice(0, 3).map(s => ({
        name: s.supplier_name,
        score: s.finalScore
      })))
  }

  return sorted
}

/**
 * Filter products by relevance score
 * Checks product name, keywords, and other relevant fields
 * Uses stricter matching to avoid unrelated results
 * Now with backend score support and logging
 */
export function filterProductsByRelevance<T extends {
  item_commercial_name?: string
  item_key_words?: string
  item_code?: string
  match_score?: number
  relevance_score?: number
  [key: string]: any
}>(
  products: T[],
  searchQuery: string,
  minScore: number = 15 // Lowered default from 25 to 15 for better coverage
): (T & { finalScore: number })[] {
  if (!products || products.length === 0) {
    console.log("[ProductFilter] No products to filter")
    return []
  }

  if (!searchQuery.trim()) return products.map(p => ({ ...p, finalScore: 0 }))

  const query = searchQuery.trim().toLowerCase()
  const andTokens = tokenizeSearchQueryForAnd(searchQuery)

  /** When the user typed 2+ tokens (e.g. "inya 500"), every token must match (AND). */
  const productsInput =
    andTokens.length > 1
      ? products.filter((p) => productMatchesAllSearchTokens(p, andTokens))
      : products

  if (productsInput.length === 0 && andTokens.length > 1) {
    console.log("[ProductFilter] No products left after AND token filter for query:", query)
    return []
  }

  const terms =
    andTokens.length > 0
      ? andTokens
      : query.split(/\s+/).filter((t) => t.length >= 2)

  const effectiveMinScore = andTokens.length > 1 ? 0 : minScore

  console.log(
    `[ProductFilter] Filtering ${productsInput.length}/${products.length} products, ${terms.length} term(s), AND=${andTokens.length > 1}, query: "${searchQuery}", minScore=${effectiveMinScore}`
  )

  const scoredProducts = productsInput.map((product) => {
    // Start with backend score if available
    const baseScore = (product.match_score || product.relevance_score || 0)
    const q = product as Record<string, unknown>

    const commercialName = String(
      product.item_commercial_name || q.item_name || q.ITEM_NAME || q.name || ''
    )
    const keywords = String(
      product.item_key_words || q.item_keywords || q.ITEM_KEYWORDS || q.ITEM_KEY_WORDS || ''
    )

    // Calculate frontend scores using multilingual matching
    const nameScore = calculateRelevanceScore(searchQuery, commercialName)

    const keywordsScore = calculateRelevanceScore(searchQuery, keywords, {
      exactMatchBonus: 80,
      startsWithBonus: 40,
      containsBonus: 12,
      wordBoundaryBonus: 25,
      translationBonus: 35,
    })

    // Additional term matching for item code and NIKI code (case-insensitive, digit-aware)
    const code = String(
      product.item_code || q.ITEM_CODE || q.niki_code || q.NIKI_CODE || ''
    ).toLowerCase()
    let codeScore = 0
    for (const term of terms) {
      if (/^\d+$/.test(term)) {
        // Numeric code: use word boundary matching
        const re = new RegExp(`(?<!\\d)${escapeRegex(term)}(?!\\d)`)
        if (re.test(code)) codeScore += 5
      } else if (code.includes(term)) {
        codeScore += 15
      }
    }

    // Also check description and other fields
    const desc = String(q.item_description ?? q.description ?? '').toLowerCase()
    const brand = String(q.item_fabricant ?? q.brand ?? q.BRAND ?? '').toLowerCase()
    const famille = String(q.famille ?? q.FAMILLE ?? '').toLowerCase()

    let otherFieldsScore = 0
    for (const term of terms) {
      if (desc.includes(term)) otherFieldsScore += 2
      if (brand.includes(term)) otherFieldsScore += 10
      if (famille.includes(term)) otherFieldsScore += 3
    }

    const frontendScore = Math.max(nameScore, keywordsScore)
    const hasAnyFieldMatch = frontendScore > 0 || codeScore > 0 || otherFieldsScore > 0

    // Discard products that have 0 match with the query in all fields
    if (!hasAnyFieldMatch) {
      return { ...product, finalScore: 0 }
    }

    // Combine scores: take max of multilingual scores + backend score + code score + other fields
    const finalScore = Math.max(baseScore, frontendScore) + codeScore + otherFieldsScore

    return { ...product, finalScore }
  })

  const filtered = scoredProducts.filter((item) => item.finalScore >= effectiveMinScore)
  const sorted = filtered.sort((a, b) => b.finalScore - a.finalScore)

  const filteredOutCount = scoredProducts.length - filtered.length
  console.log(
    `[ProductFilter] Kept ${sorted.length}/${scoredProducts.length} products with score >= ${effectiveMinScore}${filteredOutCount > 0 ? ` (filtered out ${filteredOutCount})` : ""}`
  )
  if (sorted.length > 0) {
    console.log(`[ProductFilter] Top 3 scores:`, sorted.slice(0, 3).map(p => ({
      name: p.item_commercial_name,
      code: p.item_code,
      score: p.finalScore
    })))
  } else if (scoredProducts.length > 0 && filtered.length === 0) {
    // Log filtered-out products for debugging
    console.warn(`[ProductFilter] All ${scoredProducts.length} products filtered out (minScore=${effectiveMinScore}). Top 5 scores:`, 
      scoredProducts.sort((a, b) => b.finalScore - a.finalScore).slice(0, 5).map(p => ({
        name: p.item_commercial_name,
        code: p.item_code,
        score: p.finalScore
      })))
  }

  return sorted
}

/**
 * Check if search query matches target with word boundaries
 * This ensures "insta" matches "INSTA SHOP" but not "fanta"
 */
export function isWordBoundaryMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase().trim()

  if (!q || !t) return false

  // Exact match
  if (t === q) return true

  // Starts with
  if (t.startsWith(q)) return true

  // Word boundary match
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(q)}`, 'i')
  return wordBoundaryRegex.test(t)
}

/**
 * Highlight matching text in a string
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}
