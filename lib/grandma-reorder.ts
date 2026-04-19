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
  const s = String(hint ?? "").trim().toLowerCase()
  if (!s) return undefined
  if (s.includes("pharm")) return "Pharmacy"
  if (s.includes("liquor") || s.includes("wine") || s.includes("spirits")) return "Liquor Store"
  if (s.includes("restaurant") || s.includes("bar-resto") || s.includes("bar/restaurant")) return "Restaurant"
  if (s.includes("supermarket") || s.includes("grocery")) return "Supermarket"
  if (s.includes("bakery") || s.includes("coffee")) return "Bakery"
  if (s.includes("vet")) return "Veterinary"
  if (s.includes("boutique")) return "Boutique"
  if (s.includes("others") || s.includes("general")) return "Others"
  return undefined
}

export function buildGrandmaShopId(sellerAccount: string | undefined | null): string | null {
  const base = String(sellerAccount ?? "").replace(/^supplier_/, "").trim()
  if (!base) return null
  return `supplier_${base}`
}
