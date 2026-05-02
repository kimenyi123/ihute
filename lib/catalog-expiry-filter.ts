import { parseItemStateBatchExpiry } from "@/lib/item-state-display"

/** True when `item_state` / `ITEM_STATE` has a strict `Ex:ddmmyy` that parses to a calendar date before today. */
export function isExpiredCatalogLineItemState(raw: unknown): boolean {
  const { isExpired, expiryAt } = parseItemStateBatchExpiry(raw)
  return Boolean(expiryAt && isExpired)
}

export function stripExpiredProductsFromArray(products: unknown[]): unknown[] {
  if (!Array.isArray(products)) return products
  return products.filter((p) => {
    if (!p || typeof p !== "object") return true
    const o = p as Record<string, unknown>
    const state = o.item_state ?? o.ITEM_STATE
    return !isExpiredCatalogLineItemState(state)
  })
}

export function stripExpiredFromFetchSuggestionsBody(parsed: { products?: unknown[] } | null | undefined): void {
  if (!parsed?.products || !Array.isArray(parsed.products)) return
  parsed.products = stripExpiredProductsFromArray(parsed.products) as typeof parsed.products
}

export function stripExpiredFromShopWithMeBody(data: {
  sellers?: unknown[]
} | null | undefined): void {
  if (!data?.sellers || !Array.isArray(data.sellers)) return
  for (const s of data.sellers) {
    if (!s || typeof s !== "object") continue
    const seller = s as Record<string, unknown>
    const prods = seller.products
    if (Array.isArray(prods)) {
      const next = stripExpiredProductsFromArray(prods)
      seller.products = next
      seller.product_count = next.length
    }
  }
}
