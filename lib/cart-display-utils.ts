import { unitMeaningfulForDisplay } from "@/lib/product-unit-display"

/**
 * `item_packet` / `unit` from Redis/API is often a stock count (e.g. "40", "24.0"), not a customer-facing unit.
 * Only show alongside price when it looks like a real unit (pcs, kg, 500ml, etc.).
 */
export function displayUnitForPrice(unit?: string | null): string | null {
  if (!unitMeaningfulForDisplay(unit)) return null
  return String(unit).trim()
}

export const DEFAULT_CART_CURRENCY = "RWF"
