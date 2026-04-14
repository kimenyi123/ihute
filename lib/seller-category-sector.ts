/**
 * Map shop category (seller onboarding) to `sector` query param for /api/fetchSuggestions.
 * Aligns with `SECTOR_OPTIONS` in app/search (e.g. pharmacy, bar-resto, liquor-store).
 */
const MAP: Record<string, string> = {
  pharmacy: "pharmacy",
  "liquor store": "liquor-store",
  boutique: "boutique",
  "bar/restaurant": "bar-resto",
  supermarket: "supermarket",
  "coffee shop": "coffee-shop",
  pizzeria: "bar-resto",
  electronics: "general",
}

export function shopCategoryToSectorSlug(category: string): string {
  const k = category.trim().toLowerCase()
  if (MAP[k]) return MAP[k]
  return k.replace(/\s+/g, "-").replace(/[/']/g, "-")
}

/**
 * Grandma `/grandma` sector grid → Kaos `listSuppliersWithProducts` slug.
 * Must match `chaos_theta.account_seller.preferedcategories` style (kebab-case, e.g. `pharmacy`, `liquor-store`)
 * and `fetchSuggestions.getCategoryTokensFromSlug` — not `bar-resto` for liquor (that is bars/restaurants).
 */
export const GRANDMA_CATEGORY_TO_SECTOR_SLUG: Record<string, string> = {
  Boutique: "boutique",
  Supermarket: "supermarket",
  Pharmacy: "pharmacy",
  Restaurant: "restaurant",
  "Liquor Store": "liquor-store",
  Bakery: "coffee-shop",
  Veterinary: "veterinary",
  Others: "others",
}
