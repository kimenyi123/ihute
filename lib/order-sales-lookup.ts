/** Client-safe helpers for matching order sales codes to product rows. */

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Lookup units sold trying every catalog / NIKI code alias on a product row. */
export function lookupUnitsSold(
  product: Record<string, unknown>,
  salesByCode: Map<string, number> | Record<string, number>,
): number {
  const get = (code: string): number => {
    const k = code.trim().toUpperCase()
    if (!k) return 0
    if (salesByCode instanceof Map) return num(salesByCode.get(k))
    return num(salesByCode[k])
  }
  for (const key of [
    "ITEM_CODE",
    "item_code",
    "itemCode",
    "item_key_words",
    "niki_code",
    "NIKI_CODE",
  ]) {
    const qty = get(nz(product[key]))
    if (qty > 0) return qty
  }
  return 0
}
