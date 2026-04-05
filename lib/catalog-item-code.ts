/**
 * Catalog / order line codes for Java `NIKI_CODE` and cart `itemCode`.
 * Must not use internal dedupe strings that contain U+241E or other non-latin1 bytes.
 */

type ApiProductLike = {
  ITEM_CODE?: string
  item_code?: string
  item_key_words?: string
}

/** Same priority as shop-with-me `getItemCode`: backend SKU → item_code → item_keyword (NIKI). */
export function catalogItemCodeFromApi(p: ApiProductLike): string {
  return String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? "").trim()
}

/**
 * Strip characters that break typical MySQL `latin1` / older `utf8` NIKI_CODE columns.
 * U+241E (used in Grandma dedupe keys) encodes as E2 90 9E and triggers "Incorrect string value".
 */
export function sanitizeItemCodeForOrderDb(raw: string): string {
  let s = raw
    .replace(/\u241e/g, " ")
    .replace(/[\r\n\t\u0000-\u001f]/g, " ")
    .trim()
  if (!s) return ""
  const ascii = s.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim()
  return (ascii || s).slice(0, 120)
}

/** When API sends no code, use stable ASCII-only fallback (never `liveKey` composite). */
export function fallbackLiveItemCode(supplierId: string, stableNumericId: number): string {
  const base = `${supplierId}-itm-${stableNumericId}`.replace(/[^\w.-]/g, "_")
  return base.slice(0, 120)
}
