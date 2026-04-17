/**
 * `item_packet` / `unit` from Redis/API is often a stock count (e.g. "40"), not a customer-facing unit.
 * Only show alongside price when it looks like a real unit (pcs, kg, 500ml, etc.).
 */
export function displayUnitForPrice(unit?: string | null): string | null {
  if (unit == null) return null
  const t = String(unit).trim()
  if (t === "") return null
  if (/^\d+$/.test(t)) return null
  return t
}

export const DEFAULT_CART_CURRENCY = "RWF"
