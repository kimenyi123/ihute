/**
 * FMCG shelf — available for every shop category (bar, resto, pharmacy, boutique, retail, …).
 *
 * 1) Prefer taxonomy matches (packaged drinks/snacks/grocery OR pharmacy OTC/toiletries).
 * 2) Must have sales in the lookback window.
 * 3) If taxonomy finds nothing but the shop has sales → fallback: top sellers by velocity
 *    (still exclude menu pours, durables, specialty Rx).
 * 4) A/B/C Pareto on that sold set.
 */

import {
  compareByAbcThenVelocity,
  enrichWithVelocityAndAbc,
  VELOCITY_LOOKBACK_DAYS,
  type VelocityStats,
} from "@/lib/sales-velocity"

export type FmcgShopContext = {
  isPharmacy?: boolean
  isBarOrRestaurant?: boolean
}

const FMCG_FAMILLE_OR_CATEGORY =
  /\b(fmcg|fmcgp|grocery|supermar|convenience|soft\s*drinks?|fresh\s*juice|smoothies?|beverages?|snacks?|bakery|bread|dairy|milk|water|soda|juice|tea|coffee|beer|lager|spirits?|vodka|whisky|whiskey|rum|gin|personal\s*care|toiletr|soap|shampoo|toothpaste|deodorant|lotion|skincare|household|detergent|tissue|toilet\s*paper|disinfectant|cleaning|diaper|baby\s*care|baby\s*food|hygiene|sanitary|otc|pharmacy\s*consum|packaged\s*food|cereals?|canned|flour|rice|sugar|cooking\s*oil|cosmetic|parapharmac|wellness|vitamin|supplement|boutique|fashion\s*care)\b/i

const NOT_FMCG_FAMILLE_OR_CATEGORY =
  /\b(cold\s*starters?|hot\s*starters?|starters?|main\s*courses?|burgers?|pasta|pizzas?|wraps?|platter|sizzling|barbecue|bbq|mother\s*style|accompaniments?|vegetables?|desserts?|cream|cocktails?|shot\s*cocktails?|coffee\s*cocktails?|virgin\s*mojitos?|hot\s*coffee|iced\s*coffee|hot\s*tea|breakfast|omelet|salad\s*bar)\b/i

const NOT_FMCG_PRODUCT_NAME =
  /\b(a\s+glass\s+of|glass\s+of|per\s+glass|by\s+the\s+glass|shot\s+of|cocktail|martini|mojito|mocktail)\b/i

const FMCG_PRODUCT_TEXT =
  /\b(rice|flour|sugar|bread|snack|chips|cereal|canned|cooking\s*oil|soft\s*drink|soda|cola|fanta|sprite|bottled\s*water|mineral\s*water|juice|tea\s*bag|ground\s*coffee|milk|yogurt|butter|toothpaste|soap|shampoo|deodorant|lotion|detergent|dish\s*soap|toilet\s*paper|tissue|disinfectant|diaper|wipe|sanitary|nestle|unilever|coca.?cola|pepsi|colgate|heineken|amstel|red\s*bull|bavaria)\b/i

const PHARMACY_FMCG_TEXT =
  /\b(soap|shampoo|toothpaste|toothbrush|deodorant|lotion|cream|moisturizer|sunscreen|sanitary|pad|tampon|diaper|wipe|tissue|cotton|bandage|plaster|antiseptic|alcohol|glove|condom|lubricant|vitamin|multivitamin|supplement|zinc|calcium|ors|oral\s*rehydration|paracetamol|acetaminophen|ibuprofen|aspirin|cough|lozenge|menthol|vaseline|petroleum|baby\s*oil|nappy|hygiene|toiletr|colgate|nivea|dettol|savlon|always|pampers)\b/i

const SPECIALTY_RX_TEXT =
  /\b(forxiga|dapagliflozin|metformin|insulin|amoxicillin|augmentin|ciprofloxacin|azithromycin|atorvastatin|amlodipine|losartan|omeprazole|pantoprazole|prednisolone|morphine|tramadol|antiretroviral|arv\b|chemo)\b/i

const DURABLE_OR_NON_FMCG_TEXT =
  /\b(tv|television|refrigerator|fridge|washing\s*machine|laptop|phone|smartphone|tablet|furniture|mattress|nebulizer|glucometer|bp\s*monitor|blood\s*pressure)\b/i

function productHaystack(product: Record<string, unknown>): string {
  return [
    product.famille,
    product.FAMILLE,
    product.category,
    product.item_department,
    product.item_commercial_name,
    product.item_name,
    product.item_key_words,
    product.item_keywords,
    product.keywords_en,
    product.brand,
    product.item_fabricant,
    product.description,
  ]
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ")
    .toLowerCase()
}

function familleOrCategory(product: Record<string, unknown>): string {
  return String(
    product.famille ?? product.FAMILLE ?? product.category ?? product.item_department ?? "",
  )
    .trim()
    .toLowerCase()
}

function productName(product: Record<string, unknown>): string {
  return String(product.item_commercial_name ?? product.item_name ?? product.ITEM_NAME ?? "")
    .trim()
    .toLowerCase()
}

function isExcludedHard(product: Record<string, unknown>): boolean {
  const hay = productHaystack(product)
  const name = productName(product)
  const fam = familleOrCategory(product)
  if (name && NOT_FMCG_PRODUCT_NAME.test(name)) return true
  if (fam && NOT_FMCG_FAMILLE_OR_CATEGORY.test(fam)) return true
  if (DURABLE_OR_NON_FMCG_TEXT.test(hay)) return true
  if (SPECIALTY_RX_TEXT.test(hay)) return true
  return false
}

/** Packaged grocery / bar FMCG. */
export function isFmcgProduct(product: Record<string, unknown>): boolean {
  if (isExcludedHard(product)) return false
  const fam = familleOrCategory(product)
  if (fam === "fmcg" || fam === "fmcgp") return true
  const hay = productHaystack(product)
  if (fam && FMCG_FAMILLE_OR_CATEGORY.test(fam)) return true
  if (FMCG_PRODUCT_TEXT.test(hay)) return true
  return false
}

/** Pharmacy OTC / toiletries / hygiene. */
export function isPharmacyFmcgProduct(product: Record<string, unknown>): boolean {
  if (isExcludedHard(product)) return false
  if (isFmcgProduct(product)) return true
  const hay = productHaystack(product)
  if (PHARMACY_FMCG_TEXT.test(hay)) return true
  const fam = familleOrCategory(product)
  if (/\b(otc|cosmetic|parapharmac|hygiene|baby|vitamin|wellness|personal\s*care)\b/i.test(fam)) {
    return true
  }
  return false
}

/** Any shop: grocery FMCG or pharmacy-style consumable. */
export function isFmcgCandidateForAnyShop(product: Record<string, unknown>): boolean {
  return isFmcgProduct(product) || isPharmacyFmcgProduct(product)
}

/** Sold SKU allowed in universal velocity fallback (all shop categories). */
function isUniversalSalesFallbackEligible(product: Record<string, unknown>): boolean {
  return !isExcludedHard(product)
}

function rankSoldShelf<T extends Record<string, unknown>>(
  sold: (T & VelocityStats)[],
  maxItems: number,
): (T & VelocityStats)[] {
  if (sold.length === 0) return []
  const ranked = enrichWithVelocityAndAbc(sold, VELOCITY_LOOKBACK_DAYS)
  return [...ranked].sort(compareByAbcThenVelocity).slice(0, maxItems)
}

/**
 * FMCG section for every shop category.
 * Taxonomy first; if empty, fall back to top sellers by velocity (all categories).
 */
export function buildFmcgShelf<T extends Record<string, unknown>>(
  products: T[],
  maxItems = 48,
  _ctx?: FmcgShopContext,
): (T & VelocityStats)[] {
  // 1) Taxonomy matches (works for bar, grocery, pharmacy, boutique, …)
  const taxonomyHits = products.filter((p) => isFmcgCandidateForAnyShop(p))
  const taxonomySold = enrichWithVelocityAndAbc(taxonomyHits, VELOCITY_LOOKBACK_DAYS).filter(
    (p) => p.unitsSold > 0 && p.salesVelocity > 0,
  )
  if (taxonomySold.length > 0) {
    return rankSoldShelf(taxonomySold, maxItems)
  }

  // 2) Universal fallback — any shop with order history (pharmacy Other, retail, etc.)
  const fallbackSold = enrichWithVelocityAndAbc(products, VELOCITY_LOOKBACK_DAYS).filter(
    (p) =>
      p.unitsSold > 0 &&
      p.salesVelocity > 0 &&
      isUniversalSalesFallbackEligible(p),
  )
  return rankSoldShelf(fallbackSold, maxItems)
}

export const FMCG_SECTION_NAME = "FMCG"
export const FMCG_SECTION_SUBTITLE =
  "Available on every shop — items with recent sales, ranked Fast/Medium/Slow by units sold"
