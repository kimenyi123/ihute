/** Product SKU / NIKI codes — short but meaningful; bypass text min-length guard. */
export const PRODUCT_CODE_SEARCH_PATTERN = /^[A-Z0-9]{4,}$/i

export const MIN_TEXT_SEARCH_LENGTH = 3

export function isProductCodeSearchQuery(term: string): boolean {
  const t = term.trim()
  return t.length > 0 && PRODUCT_CODE_SEARCH_PATTERN.test(t)
}

/** True when a trimmed query should run keyword search (not full catalog / empty). */
export function shouldRunTextSearch(
  query: string,
  minLength: number = MIN_TEXT_SEARCH_LENGTH,
): boolean {
  const t = query.trim()
  if (!t) return false
  if (isProductCodeSearchQuery(t)) return true
  return t.length >= minLength
}
