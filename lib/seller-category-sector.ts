/**
 * Map shop category (seller onboarding) to `sector` query param for /api/fetchSuggestions.
 * Aligns with Kaos `preferedcategories` slugs. Grandma labels live in `lib/grandma-categories.ts`.
 */
import {
  GRANDMA_CATEGORY_TO_SECTOR_SLUG as CATALOG_SLUGS,
  resolveGrandmaCategory as resolveFromCatalog,
} from "@/lib/grandma-categories"

export {
  GRANDMA_CATEGORY_CATALOG,
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  GRANDMA_REGISTRATION_CATEGORY_VALUES,
  displayGrandmaShopName,
  grandmaCategoryLabel,
  grandmaNavCategories,
  grandmaOthersChildCategories,
  grandmaSectorLikePatterns,
  isKnownGrandmaCategoryInput,
  isOthersChildCategory,
  isOthersHubCategory,
  isPlaceholderGrandmaShopName,
  resolveGrandmaCategory,
  resolveSellerDisplayCategory,
  type GrandmaCategoryLabel,
} from "@/lib/grandma-categories"

const MAP: Record<string, string> = {
  pharmacy: "pharmacy",
  "liquor store": "liquor-store",
  boutique: "boutique",
  "bar/restaurant": "restaurant",
  supermarket: "supermarket",
  "coffee shop": "coffee-shop",
  pizzeria: "restaurant",
  electronics: "electronics",
  veterinary: "veterinary",
  "home supplies": "home-supplies",
  "building materials": "building-materials",
  "auto parts": "auto-parts",
  other: "others",
  others: "others",
}

export function shopCategoryToSectorSlug(category: string): string {
  const k = category.trim().toLowerCase()
  if (MAP[k]) return MAP[k]
  const resolved = resolveFromCatalog(category)
  if (resolved && CATALOG_SLUGS[resolved]) return CATALOG_SLUGS[resolved]
  return k.replace(/\s+/g, "-").replace(/[/']/g, "-")
}
