import type { MoodOption, SellerMoodSector } from "@/lib/seller-mood-options"
import { SURPRISE_MOOD_ID } from "@/lib/seller-surprise-config"

/** Flatten product fields used for mood / surprise keyword matching. */
export function getProductSearchHaystack(product: Record<string, unknown>): string {
  const parts = [
    product.item_commercial_name,
    product.item_name,
    product.ITEM_NAME,
    product.category,
    product.famille,
    product.FAMILLE,
    product.item_department,
    product.item_key_words,
    product.item_key_words_french,
    product.item_key_words_kinyarwanda,
    product.ITEM_CODE,
    product.item_code,
    product.description,
    product.item_description,
    product.brand,
    product.item_fabricant,
  ]
  return parts
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ")
    .toLowerCase()
}

export function getProductFamille(product: Record<string, unknown>): string {
  return String(product.famille ?? product.FAMILLE ?? product.category ?? product.item_department ?? "")
    .trim()
    .toLowerCase()
}

const ALCOHOL_WORDS =
  /\b(wine|wines|beer|beers|lager|ale|stout|porter|cider|whisky|whiskey|vodka|rum|gin|tequila|cognac|brandy|champagne|spirit|spirits|cocktail|cocktails|liqueur|aperitif|digestif|schnapps|sake|mezcal|absinthe|bitters)\b/i

const ALCOHOL_FAMILLE =
  /\b(wine|beer|spirits?|cocktail|liquor|alcohol|champagne|whisky|whiskey|vodka|rum|gin|lager|ale|cider)\b/i

const FOOD_WORDS =
  /\b(omelet|omelette|burger|pizza|pasta|rice|beef|pork|goat|lamb|mutton|chicken|fish|seafood|salad|starter|main course|dessert|sandwich|wrap|platter|bbq|barbecue|soup|bread|cake|pastry|snack|chips|fries|egg|bacon|sausage|steak|omelet|wings|nachos|taco|burrito|curry|stew|grill|sizzling|omelet|pancake|waffle|toast|croissant)\b/i

const BEVERAGE_WORDS =
  /\b(juice|smoothie|soft drink|soda|cola|fanta|sprite|water|mineral water|malt(?! beer)|energy drink|red bull|virgin|mocktail|non.?alcohol|zero alcohol|alcohol.?free|iced tea|hot tea|hot coffee|iced coffee|tea|coffee|lemonade|milkshake|ginger ale|tonic|schweppes|beverage|drink|drinks|refresco)\b/i

const BEVERAGE_FAMILLE =
  /\b(beverage|beverages|soft drink|juice|water|drink|drinks|soda|tea|coffee|mocktail|non.?alcohol)\b/i

const MEAT_WORDS =
  /\b(beef|pork|goat|lamb|mutton|steak|burger|bbq|barbecue|meat|bacon|ham|sausage|ribs|platter|sizzling)\b/i

const WHITE_MEAT_WORDS =
  /\b(chicken|fish|seafood|turkey|duck|prawn|shrimp|salmon|tilapia|trout|tuna|calamari|octopus|white meat)\b/i

const VEG_WORDS =
  /\b(vegetable|vegetables|vegan|vegetarian|salad|vg\b|plant.?based|greens|veggie)\b/i

export function productIsAlcoholic(product: Record<string, unknown>): boolean {
  if (product.isAlcohol === true) return true
  if (product.isAlcohol === false) return false
  const hay = getProductSearchHaystack(product)
  const fam = getProductFamille(product)
  if (/\bnon.?alcohol|alcohol.?free|virgin|mocktail|soft drink\b/i.test(hay)) return false
  if (
    /\b(fresh juice|soft drink|smoothie|hot coffee|iced coffee|hot tea|virgin mojito)\b/i.test(fam) &&
    !/\b(wine|beer|whisky|whiskey|vodka|rum|gin|spirit|lager|ale|cider|champagne)\b/i.test(hay)
  ) {
    return false
  }
  return ALCOHOL_WORDS.test(hay) || ALCOHOL_FAMILLE.test(fam)
}

export function productIsNonAlcoholicBeverage(product: Record<string, unknown>): boolean {
  if (productIsAlcoholic(product)) return false
  const hay = getProductSearchHaystack(product)
  const fam = getProductFamille(product)
  if (FOOD_WORDS.test(hay) && !BEVERAGE_WORDS.test(hay) && !BEVERAGE_FAMILLE.test(fam)) return false
  return BEVERAGE_WORDS.test(hay) || BEVERAGE_FAMILLE.test(fam)
}

export function productIsMeatDish(product: Record<string, unknown>): boolean {
  const hay = getProductSearchHaystack(product)
  if (VEG_WORDS.test(hay) && !MEAT_WORDS.test(hay) && !WHITE_MEAT_WORDS.test(hay)) return false
  return MEAT_WORDS.test(hay)
}

export function productIsWhiteMeatDish(product: Record<string, unknown>): boolean {
  const hay = getProductSearchHaystack(product)
  return WHITE_MEAT_WORDS.test(hay)
}

export function productIsVegetarianFriendly(product: Record<string, unknown>): boolean {
  const hay = getProductSearchHaystack(product)
  if (MEAT_WORDS.test(hay) || WHITE_MEAT_WORDS.test(hay)) return false
  return VEG_WORDS.test(hay)
}

export function getProductItemCode(product: Record<string, unknown>): string {
  return String(product.ITEM_CODE ?? product.item_code ?? product.item_key_words ?? "").trim()
}

export function getProductDiscountPercent(product: Record<string, unknown>): number {
  if (typeof product.discountPercent === "number") return product.discountPercent
  const selling = extractNumeric(product.selling_price ?? product.price ?? product.UNITY_PRICE)
  const cost = extractNumeric(product.cost_price)
  if (cost > 0 && selling > 0 && selling < cost) {
    return Math.round((1 - selling / cost) * 100)
  }
  return 0
}

export function getProductFavoriteScore(product: Record<string, unknown>): number {
  if (typeof product.favoriteScore === "number") return product.favoriteScore
  if (typeof product.totalSold === "number") return product.totalSold
  return 0
}

export function getProductTrendScore(product: Record<string, unknown>): number {
  const salesLast6Hours = typeof product.salesLast6Hours === "number" ? product.salesLast6Hours : undefined
  const salesToday = typeof product.salesToday === "number" ? product.salesToday : undefined
  if (salesLast6Hours !== undefined && salesToday !== undefined) {
    return salesLast6Hours * 3 + salesToday
  }
  const code = getProductItemCode(product)
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return (h % 20) + 1
}

export function productInStock(product: Record<string, unknown>): boolean {
  const stockQty = typeof product.stockQty === "number" ? product.stockQty : Number(product.stock ?? product.item_packet ?? 0)
  return stockQty > 0 || product.in_stock !== false
}

function extractNumeric(value: unknown): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

export type MoodFilterContext = {
  sector?: SellerMoodSector | null
  supplierAccount?: string | null
  /** User hearted product ids for the current shop. */
  shopFavoriteIds?: Set<string>
}

export type FavoritesMoodMode = "yours" | "popular" | null

function matchesPharmacyOrRetailRegex(
  product: Record<string, unknown>,
  option: MoodOption
): boolean {
  const hay = getProductSearchHaystack(product)
  if (!hay) return false
  if (option.excludeRegex?.test(hay)) return false
  return option.categoryRegex.test(hay)
}

/** Domain-precise mood match — no loose guessing for food / liquor / special pills. */
export function productMatchesMoodOption(
  product: Record<string, unknown>,
  option: MoodOption,
  ctx: MoodFilterContext = {}
): boolean {
  const id = option.id
  const sector = ctx.sector ?? "retail"

  switch (id) {
    case "white-wine":
      return productIsAlcoholic(product)
    case "whisky":
      return productIsNonAlcoholicBeverage(product)
    case "meat":
      return productIsMeatDish(product)
    case "vg":
      return productIsVegetarianFriendly(product)
    case "white-meat":
      return productIsWhiteMeatDish(product)
    case "beer":
      return productInStock(product)
    case "cocktails":
      return getProductDiscountPercent(product) > 0
    case "coffee": {
      const code = getProductItemCode(product)
      if (ctx.shopFavoriteIds?.size && code && ctx.shopFavoriteIds.has(code)) return true
      if (!ctx.shopFavoriteIds?.size) {
        return getProductFavoriteScore(product) > 0 || productInStock(product)
      }
      return false
    }
    case SURPRISE_MOOD_ID:
      return productInStock(product)
    default:
      if (sector === "pharmacy" || sector === "retail") {
        return matchesPharmacyOrRetailRegex(product, option)
      }
      return matchesPharmacyOrRetailRegex(product, option)
  }
}

export function filterProductsByMoodOption<T extends Record<string, unknown>>(
  products: T[],
  option: MoodOption,
  ctx: MoodFilterContext = {}
): T[] {
  if (option.id === "coffee") {
    const favIds = ctx.shopFavoriteIds
    if (favIds && favIds.size > 0) {
      const yours = products.filter((p) => {
        const code = getProductItemCode(p)
        return code && favIds.has(code)
      })
      if (yours.length > 0) return yours
    }
    const popular = products.filter((p) => getProductFavoriteScore(p) > 0)
    if (popular.length > 0) return popular
    return [...products].filter(productInStock)
  }

  return products.filter((p) => productMatchesMoodOption(p, option, ctx))
}

export function resolveFavoritesMoodMode(
  products: Record<string, unknown>[],
  option: MoodOption,
  ctx: MoodFilterContext
): FavoritesMoodMode {
  if (option.id !== "coffee") return null
  const favIds = ctx.shopFavoriteIds
  if (favIds && favIds.size > 0) {
    const yours = products.some((p) => {
      const code = getProductItemCode(p)
      return code && favIds.has(code)
    })
    if (yours) return "yours"
  }
  return "popular"
}

export function sortProductsByMoodOption<T extends Record<string, unknown>>(
  products: T[],
  option: MoodOption
): T[] {
  const sorted = [...products]
  switch (option.id) {
    case "white-wine":
      return sortProductsByPopularityThenName(sorted)
    case "beer":
      return sorted.sort((a, b) => getProductTrendScore(b) - getProductTrendScore(a))
    case "cocktails":
      return sorted.sort((a, b) => getProductDiscountPercent(b) - getProductDiscountPercent(a))
    case "coffee":
      return sorted.sort((a, b) => getProductFavoriteScore(b) - getProductFavoriteScore(a))
    default:
      return sorted
  }
}

export function getMoodSectionLabel(option: MoodOption, favoritesMode: FavoritesMoodMode): string {
  if (option.id === "coffee") {
    if (favoritesMode === "yours") return "Your favorites"
    return "Popular with others"
  }
  return option.label
}

export type AlcoholSubcategoryKey = "spirits" | "wine" | "beer" | "cocktails" | "other"

const ALCOHOL_SUBCATEGORY_ORDER: { key: AlcoholSubcategoryKey; label: string }[] = [
  { key: "spirits", label: "Spirits" },
  { key: "wine", label: "Wine & sparkling" },
  { key: "beer", label: "Beer & cider" },
  { key: "cocktails", label: "Cocktails & mixed drinks" },
  { key: "other", label: "Other alcohol" },
]

/** Classify an alcoholic product for grouped display (spirits before cocktails). */
export function getAlcoholSubcategoryKey(product: Record<string, unknown>): AlcoholSubcategoryKey {
  const fam = getProductFamille(product)
  const hay = getProductSearchHaystack(product)

  const cocktailFam =
    /\b(cocktail|shot cocktail|coffee cocktail|mojito|margarita|martini|daiquiri|negroni|spritz|old fashioned)\b/i
  const cocktailHay = /\b(cocktail|mojito|martini|margarita|daiquiri|irish coffee|espresso martini)\b/i

  if (cocktailFam.test(fam) || cocktailHay.test(hay)) return "cocktails"

  if (
    /\b(whisky|whiskey|vodka|rum|gin|cognac|brandy|tequila|spirit|liqueur|mezcal|schnapps|bitters)\b/i.test(fam)
  ) {
    return "spirits"
  }
  if (/\b(wine|sparkling|champagne|prosecco|rose)\b/i.test(fam)) return "wine"
  if (/\b(beer|lager|ale|cider|stout|porter)\b/i.test(fam)) return "beer"

  if (/\b(whisky|whiskey|vodka|rum|gin|cognac|brandy|tequila|jameson|jack daniel|hennessy)\b/i.test(hay)) {
    return "spirits"
  }
  if (/\b(champagne|prosecco|\bwine\b)/i.test(hay)) return "wine"
  if (/\b(beer|lager|heineken|stout|cider)\b/i.test(hay)) return "beer"
  if (cocktailHay.test(hay)) return "cocktails"

  return "other"
}

function sortProductsByPopularityThenName<T extends Record<string, unknown>>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const trend = getProductTrendScore(b) - getProductTrendScore(a)
    if (trend !== 0) return trend
    const fav = getProductFavoriteScore(b) - getProductFavoriteScore(a)
    if (fav !== 0) return fav
    const nameA = String(a.item_commercial_name ?? a.item_name ?? "").toLowerCase()
    const nameB = String(b.item_commercial_name ?? b.item_name ?? "").toLowerCase()
    return nameA.localeCompare(nameB)
  })
}

/** Split alcohol mood results into browsable sub-sections (spirits first, cocktails last). */
export function buildAlcoholCategorySections<T extends Record<string, unknown>>(
  products: T[]
): { label: string; products: T[] }[] {
  const buckets = new Map<AlcoholSubcategoryKey, T[]>()
  for (const product of products) {
    const key = getAlcoholSubcategoryKey(product)
    const list = buckets.get(key) ?? []
    list.push(product)
    buckets.set(key, list)
  }

  return ALCOHOL_SUBCATEGORY_ORDER.filter(({ key }) => (buckets.get(key)?.length ?? 0) > 0).map(
    ({ key, label }) => ({
      label,
      products: sortProductsByPopularityThenName(buckets.get(key)!),
    })
  )
}
