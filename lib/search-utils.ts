// lib/search-utils.ts
/**
 * Search Utility Functions
 * Provides client-side relevance filtering for more accurate search results
 * Includes multilingual keyword matching (English, Kinyarwanda, French)
 */

import { expandSearchQuery } from './keyword-mapping'

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
    containsBonus = 5, // Reduced from 10 - loose substring matches score very low
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
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  minScore: number = 30 // Increased default minimum score for stricter filtering
): (T & { finalScore: number })[] {
  if (!suppliers || suppliers.length === 0) {
    console.log("[SupplierFilter] No suppliers to filter")
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
  minScore: number = 25 // Increased default minimum score for stricter filtering
): (T & { finalScore: number })[] {
  if (!products || products.length === 0) {
    console.log("[ProductFilter] No products to filter")
    return []
  }

  if (!searchQuery.trim()) return products.map(p => ({ ...p, finalScore: 0 }))

  const query = searchQuery.trim().toLowerCase()
  const terms = query.split(/\s+/).filter(t => t.length >= 2)

  console.log(`[ProductFilter] Filtering ${products.length} products with ${terms.length} terms for query: "${searchQuery}"`)

  const scoredProducts = products.map(product => {
    // Start with backend score if available
    let baseScore = (product.match_score || product.relevance_score || 0)

    // Calculate frontend scores using multilingual matching
    const nameScore = calculateRelevanceScore(
      searchQuery,
      product.item_commercial_name || ''
    )

    const keywordsScore = calculateRelevanceScore(
      searchQuery,
      product.item_key_words || '',
      {
        exactMatchBonus: 80,
        startsWithBonus: 40,
        containsBonus: 12,
        wordBoundaryBonus: 25,
        translationBonus: 35
      }
    )

    // Additional simple term matching for item code
    const code = (product.item_code || '').toLowerCase()
    let codeScore = 0
    for (const term of terms) {
      if (code.includes(term)) codeScore += 3
    }

    // Combine scores: take max of multilingual scores + backend score + code score
    const frontendScore = Math.max(nameScore, keywordsScore)
    const finalScore = Math.max(baseScore, frontendScore) + codeScore

    return { ...product, finalScore }
  })

  // Filter out low-scoring results - only keep word boundary matches or better
  const filtered = scoredProducts.filter(item => item.finalScore >= minScore)
  const sorted = filtered.sort((a, b) => b.finalScore - a.finalScore)

  console.log(`[ProductFilter] Kept ${sorted.length}/${products.length} products with score >= ${minScore}`)
  if (sorted.length > 0) {
    console.log(`[ProductFilter] Top 3 scores:`, sorted.slice(0, 3).map(p => ({
      name: p.item_commercial_name,
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
