import { NextRequest, NextResponse } from "next/server"

/** Max suggestions shown in the popup (e.g. 6). */
const MAX_SUGGESTIONS = 6

/** How many products to fetch from the supplier so we can pick best matches from full catalog (e.g. 500+ from Excel). */
const SUPPLIER_FETCH_LIMIT = Number(process.env.CART_SUGGESTIONS_SUPPLIER_LIMIT) || 600

function parsePrice(value: unknown): number {
  if (typeof value === "number") return value
  const s = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".")
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function rawToSuggestion(
  p: Record<string, unknown>,
  fallbackId: string,
  reason: string = "complementary_item",
  /** When we fetched by supplier, backend may omit supplier_account; use this so we don't filter out all results. */
  fallbackSupplierId?: string
) {
  const id = String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? p.id ?? "").trim()
  const name = String(p.ITEM_NAME ?? p.item_commercial_name ?? p.name ?? p.item_name ?? "").trim()
  if (!name) return null
  const productId = id || fallbackId
  const price = parsePrice(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.item_emballage ?? p.price)
  if (price <= 0) return null
  const img = (p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? p.image) as string | undefined
  const supplierId = String(p.supplier_account ?? p.seller_account ?? p.SELLER_ISHYIGA_ACCOUNT ?? "").trim() || (fallbackSupplierId ?? "")
  const brand = (p.item_fabricant ?? p.id_fabricant ?? p.brand) as string | undefined
  return {
    product_id: productId,
    name,
    price,
    image_url: img && String(img).trim() ? String(img).trim() : undefined,
    reason,
    confidence: 0.85,
    supplier_id: supplierId,
    supplier_name: String(p.supplier_name ?? p.OWNER ?? p.SELLER_NAMES ?? ""),
    item_code: String(p.item_code ?? p.item_key_words ?? p.ITEM_CODE ?? ""),
    ...(brand ? { brand } : {}),
  }
}

/** Parse fetchSuggestions response: can be array or { products: [] } or { data: [] }. */
function parseProductList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.products)) return o.products
    if (Array.isArray(o.data)) return o.data
  }
  return []
}

/** Normalize category from product (backend may send famille, FAMILLE, item_department, category, etc.). */
function getProductCategory(p: Record<string, unknown>): string {
  const raw =
    (p.famille ?? p.FAMILLE ?? p.item_department ?? p.bus_category_id ?? p.category ?? "").toString().trim()
  return raw.toLowerCase()
}

/**
 * Classify a category *name* (from API/Excel: famille, FAMILLE, etc.) as food vs drink.
 * Product list is always from the backend (fetchSuggestions) — nothing hardcoded. This only
 * tags category strings so we can prefer e.g. drinks when cart has food.
 */
function getCategoryType(category: string): "food" | "drink" | "other" {
  if (!category) return "other"
  const c = category.toLowerCase()
  const drinkKeywords = [
    "drink", "beverage", "beverages", "juice", "bar", "beer", "wine", "coffee", "tea", "soda",
    "cocktail", "soft drink", "cold drink", "hot drink", "spirit", "liqueur", "alcool",
    "café", "boisson", "smoothie", "mocktail", "martini", "cocktails",
  ]
  const foodKeywords = [
    "main course", "course", "pasta", "rice", "pizza", "pizzas", "breakfast", "starter",
    "salad", "vegetable", "meat", "dessert", "snack", "sandwich", "soup", "burger",
    "plat", "entrée", "viande", "poisson", "goat", "beef", "pork", "chicken", "fish",
    "omelet", "omelette", "stew", "frites", "chips", "vegetarian", "veggie", "cold starters",
    "hot starters", "main course", "vegetables",
  ]
  for (const kw of drinkKeywords) {
    if (c.includes(kw)) return "drink"
  }
  for (const kw of foodKeywords) {
    if (c.includes(kw)) return "food"
  }
  return "other"
}

/** Build set of categories for items currently in cart by matching cart items to product list. */
function getCartCategories(
  cartItems: { product_id?: string; name?: string }[],
  products: unknown[]
): Set<string> {
  const set = new Set<string>()
  if (!Array.isArray(products)) return set
  const cartNames = new Set(cartItems.map((i) => (i.name ?? "").toString().trim().toLowerCase()).filter(Boolean))
  const cartIds = new Set(cartItems.map((i) => (i.product_id ?? "").toString().trim()).filter(Boolean))
  for (const row of products) {
    const p = row as Record<string, unknown>
    const name = (p.ITEM_NAME ?? p.item_commercial_name ?? p.name ?? p.item_name ?? "").toString().trim().toLowerCase()
    const id = (p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? p.id ?? "").toString().trim()
    if (!name && !id) continue
    const inCart = cartNames.has(name) || cartIds.has(id)
    if (!inCart) continue
    const cat = getProductCategory(p)
    if (cat) set.add(cat)
  }
  return set
}

/** When backend categories are missing, infer food/drink from cart item names so logic stays stable. */
function inferCartTypeFromNames(
  cartItems: { name?: string }[]
): { hasFood: boolean; hasDrink: boolean } {
  const drinkKw = ["beer", "wine", "juice", "coffee", "tea", "soda", "cocktail", "drink", "beverage", "smoothie", "martini", "milk", "water", "cola", "lemonade"]
  const foodKw = ["pork", "beef", "chicken", "fish", "rice", "pasta", "pizza", "omelet", "omelette", "salad", "soup", "stew", "burger", "sandwich", "plate", "breakfast", "main", "curry", "chips", "fries", "vegetable", "meat"]
  let hasFood = false
  let hasDrink = false
  for (const item of cartItems) {
    const n = (item.name ?? "").toString().toLowerCase()
    if (!n) continue
    for (const kw of drinkKw) {
      if (n.includes(kw)) {
        hasDrink = true
        break
      }
    }
    for (const kw of foodKw) {
      if (n.includes(kw)) {
        hasFood = true
        break
      }
    }
  }
  return { hasFood, hasDrink }
}

/**
 * Decide whether to prefer drink or food suggestions from cart categories + fallback from cart item names.
 * Stable: when in doubt (e.g. no categories from API), infer from names so pork → prefer drink, beer → prefer food.
 */
function getPreferDrinkOrFood(
  cartItems: { name?: string }[],
  cartCategories: Set<string>
): { preferDrink: boolean; preferFood: boolean } {
  const cartTypes = new Set<"food" | "drink" | "other">()
  for (const cat of cartCategories) {
    cartTypes.add(getCategoryType(cat))
  }
  let cartHasFood = cartTypes.has("food")
  let cartHasDrink = cartTypes.has("drink")
  if (cartCategories.size === 0) {
    const inferred = inferCartTypeFromNames(cartItems)
    cartHasFood = cartHasFood || inferred.hasFood
    cartHasDrink = cartHasDrink || inferred.hasDrink
  }
  return {
    preferDrink: cartHasFood && !cartHasDrink,
    preferFood: cartHasDrink && !cartHasFood,
  }
}

/**
 * Sort products so when cart has food we suggest drinks first (and vice versa), then other complementary categories.
 * Uses category names from Excel (Main Course, Pasta, Beverages, Drinks, etc.) via getCategoryType().
 */
function sortByComplementaryCategory(
  products: unknown[],
  cartItems: { name?: string }[],
  cartCategories: Set<string>
): unknown[] {
  const { preferDrink, preferFood } = getPreferDrinkOrFood(cartItems, cartCategories)

  return [...products].sort((a, b) => {
    const catA = getProductCategory(a as Record<string, unknown>)
    const catB = getProductCategory(b as Record<string, unknown>)
    const typeA = getCategoryType(catA)
    const typeB = getCategoryType(catB)
    const aComplementary = catA && !cartCategories.has(catA)
    const bComplementary = catB && !cartCategories.has(catB)

    if (preferDrink) {
      if (typeA === "drink" && typeB !== "drink") return -1
      if (typeA !== "drink" && typeB === "drink") return 1
    }
    if (preferFood) {
      if (typeA === "food" && typeB !== "food") return -1
      if (typeA !== "food" && typeB === "food") return 1
    }

    if (aComplementary && !bComplementary) return -1
    if (!aComplementary && bComplementary) return 1
    return 0
  })
}

/**
 * Build list with preferred type first (drinks when cart is food, food when cart is drink) so add order is stable.
 */
function orderByPreferredType(
  products: unknown[],
  cartItems: { name?: string }[],
  cartCategories: Set<string>
): unknown[] {
  const { preferDrink, preferFood } = getPreferDrinkOrFood(cartItems, cartCategories)
  const sorted = sortByComplementaryCategory(products, cartItems, cartCategories)
  if (!preferDrink && !preferFood) return sorted
  const preferred: unknown[] = []
  const rest: unknown[] = []
  const wantType = preferDrink ? "drink" : "food"
  for (const p of sorted) {
    const cat = getProductCategory(p as Record<string, unknown>)
    const t = getCategoryType(cat)
    if (t === wantType) preferred.push(p)
    else rest.push(p)
  }
  return [...preferred, ...rest]
}

/**
 * Cart suggestions: same supplier first (items/supplier selected), with images. Fast path.
 * 1) One call: supplierProducts=<cart supplier> → same place, same catalog, with image_url from DB.
 * 2) Only if needed: search by cart item name but keep same-supplier filter so we don't show unrelated (e.g. medicine for drinks).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const cartItems: { product_id?: string; name?: string; quantity?: number; supplier_id?: string }[] =
      Array.isArray(body.cart_items) ? body.cart_items : []

    const excludeIds = new Set(
      cartItems.map((i) => (i.product_id ?? "").toString().trim()).filter(Boolean)
    )
    const excludeNames = new Set(
      cartItems.map((i) => (i.name ?? "").toString().trim().toLowerCase()).filter(Boolean)
    )
    const cartSupplierIds = new Set(
      cartItems.map((i) => (i.supplier_id ?? "").toString().trim()).filter(Boolean)
    )
    const primarySupplier = cartItems[0]?.supplier_id?.trim() || ""

    const seen = new Set<string>()
    const suggestions: ReturnType<typeof rawToSuggestion>[] = []
    const url = new URL(req.url)
    const base = url.origin

    const addFromProducts = (
      products: unknown[],
      options: { allowedSupplierIds?: Set<string>; reason?: string; fallbackSupplierId?: string } = {}
    ) => {
      const { allowedSupplierIds = null, reason = "complementary_item", fallbackSupplierId } = options
      if (!Array.isArray(products)) return
      for (const p of products) {
        if (suggestions.length >= MAX_SUGGESTIONS) return
        const row = rawToSuggestion(p as Record<string, unknown>, "sug", reason, fallbackSupplierId)
        if (!row) continue
        const effectiveSupplierId = row.supplier_id || fallbackSupplierId || ""
        if (allowedSupplierIds && effectiveSupplierId && !allowedSupplierIds.has(effectiveSupplierId)) continue
        if (excludeIds.has(row.product_id) || excludeNames.has(row.name.toLowerCase())) continue
        const key = `${row.product_id}|${effectiveSupplierId}`
        if (seen.has(key)) continue
        seen.add(key)
        if (!row.supplier_id && fallbackSupplierId) row.supplier_id = fallbackSupplierId
        suggestions.push(row)
      }
    }

    // 1) Fast path: products from same supplier(s) as cart (one call per supplier, max 2 for speed)
    const supplierIds = Array.from(cartSupplierIds).slice(0, 2)
    for (const supplierId of supplierIds) {
      if (suggestions.length >= MAX_SUGGESTIONS || !supplierId) break
      try {
        const res = await fetch(
          `${base}/api/fetchSuggestions?supplierProducts=${encodeURIComponent(supplierId)}&limit=${SUPPLIER_FETCH_LIMIT}&Currency=RWF`,
          { cache: "no-store" }
        )
        if (!res.ok) continue
        const data = await res.json()
        const rawList = parseProductList(data)
        const cartCategories = getCartCategories(cartItems, rawList)
        const list = orderByPreferredType(rawList, cartItems, cartCategories)
        addFromProducts(list, {
          allowedSupplierIds: cartSupplierIds,
          reason: "complementary_item",
          fallbackSupplierId: supplierId,
        })
      } catch (e) {
        console.warn("[cart/suggestions] Supplier fetch failed:", supplierId, e)
      }
    }

    // 2) Only if still short: search by first cart item name but keep same-supplier filter
    if (suggestions.length < MAX_SUGGESTIONS && primarySupplier && cartItems[0]?.name) {
      try {
        const res = await fetch(
          `${base}/api/fetchSuggestions?globalSearch=${encodeURIComponent(cartItems[0].name)}&limit=${Math.min(100, SUPPLIER_FETCH_LIMIT)}&Currency=RWF`,
          { cache: "no-store" }
        )
        if (res.ok) {
          const data = await res.json()
          const rawList = parseProductList(data)
          const cartCategories = getCartCategories(cartItems, rawList)
          const list = orderByPreferredType(rawList, cartItems, cartCategories)
          addFromProducts(list, {
            allowedSupplierIds: cartSupplierIds,
            reason: "related",
          })
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
      total_suggestions: suggestions.length,
      showing: Math.min(MAX_SUGGESTIONS, suggestions.length),
    })
  } catch (e) {
    console.warn("[cart/suggestions] Error:", e)
    return NextResponse.json(
      { suggestions: [], total_suggestions: 0, showing: 0 },
      { status: 200 }
    )
  }
}
