import { resolveGrandmaCategory } from "@/lib/seller-category-sector"

/** Session payload: buyer orders panel → Grandma home applies lines to the in-app cart. */
export const GRANDMA_REORDER_STORAGE_KEY = "grandma:reorder" as const

export type GrandmaReorderLine = {
  itemCode: string
  name: string
  qty: number
  unitPrice: number
}

export type GrandmaReorderPayload = {
  v: 1
  shopId: string
  lines: GrandmaReorderLine[]
  /** Grandma sector tab (Boutique, Pharmacy, …) when known from the order — keeps Items list in sync with catalog rows. */
  grandmaCategory?: string
}

/**
 * Maps backend department / preferred-categories strings to a Grandma sector label.
 */
export function inferGrandmaCategoryFromHint(hint: string | undefined | null): string | undefined {
  const s = String(hint ?? "").trim()
  if (!s) return undefined
  const resolved = resolveGrandmaCategory(s)
  return resolved
}

export function buildGrandmaShopId(sellerAccount: string | undefined | null): string | null {
  const base = String(sellerAccount ?? "").replace(/^supplier_/, "").trim()
  if (!base) return null
  return `supplier_${base}`
}
