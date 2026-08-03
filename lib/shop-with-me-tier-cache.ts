import { createHash } from "crypto"
import { getRedis } from "@/lib/redis.server"
import { normalizeSearchTerm } from "@/lib/mysql-search-analytics"

export const TIER1_ITEM_TTL_SEC = 600
export const TIER2_SHOP_TTL_SEC = 120

export type Tier1Item = {
  item_code: string
  niki_code?: string
  item_name?: string
  item_french?: string
  IMITERERE?: string
  item_keywords?: string
  keywords_en?: string
  FAMILLE?: string
  DESCRIPTION?: string
  image_url?: string
  search_priority?: string | null
  contains_ingredient?: boolean | string
  learned_keywords?: string
  item_key_words_french?: string
  item_key_words_kinyarwanda?: string
  description?: string
  famille?: string
}

export type Tier2ShopEntry = {
  item_code: string
  SALE_PRICE_INCLUSIVE: number
  QUANTITY: number
  FAMILLE?: string
}

function itemKey(code: string): string {
  return `ihute:item:${code.trim()}`
}

function shopKey(nickname: string): string {
  return `ihute:shop:${nickname.trim().toLowerCase()}`
}

function shopMetaKey(nickname: string): string {
  return `ihute:shop-meta:${nickname.trim().toLowerCase()}`
}

export function searchMicroCacheKey(nickname: string, term: string): string {
  const raw = `${nickname.trim().toLowerCase()}:${normalizeSearchTerm(term)}`
  const hash = createHash("sha256").update(raw).digest("hex")
  return `ihute:search:${hash}`
}

export function productItemCode(p: Record<string, unknown>): string {
  return String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? "").trim()
}

export function extractTier1FromProduct(p: Record<string, unknown>): Tier1Item {
  const code = productItemCode(p)
  const niki = String(p.niki_code ?? p.NIKI_CODE ?? "").trim()
  return {
    item_code: code,
    niki_code: niki || undefined,
    item_name: String(p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "").trim() || undefined,
    item_french: String(p.item_key_words_french ?? p.item_french ?? "").trim() || undefined,
    IMITERERE: String(p.item_key_words_kinyarwanda ?? p.IMITERERE ?? "").trim() || undefined,
    item_keywords: String(p.item_keywords ?? "").trim() || undefined,
    keywords_en: String(p.keywords_en ?? "").trim() || undefined,
    FAMILLE: String(p.FAMILLE ?? p.famille ?? "").trim() || undefined,
    DESCRIPTION: String(p.DESCRIPTION ?? p.description ?? "").trim() || undefined,
    description: String(p.description ?? p.DESCRIPTION ?? "").trim() || undefined,
    famille: String(p.famille ?? p.FAMILLE ?? "").trim() || undefined,
    image_url: String(p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? "").trim() || undefined,
    search_priority: (p.search_priority as string) ?? null,
    contains_ingredient: p.contains_ingredient as boolean | string | undefined,
    learned_keywords: String(p.learned_keywords ?? "").trim() || undefined,
    item_key_words_french: String(p.item_key_words_french ?? "").trim() || undefined,
    item_key_words_kinyarwanda: String(p.item_key_words_kinyarwanda ?? "").trim() || undefined,
  }
}

export function extractTier2FromProduct(p: Record<string, unknown>): Tier2ShopEntry {
  const code = productItemCode(p)
  const priceRaw = p.SALE_PRICE_INCLUSIVE ?? p.selling_price ?? p.price ?? 0
  const qtyRaw = p.QUANTITY ?? p.stock ?? p.item_packet ?? 0
  return {
    item_code: code,
    SALE_PRICE_INCLUSIVE: Number(priceRaw) || 0,
    QUANTITY: Number(qtyRaw) || 0,
    FAMILLE: String(p.FAMILLE ?? p.famille ?? "").trim() || undefined,
  }
}

export async function getTier2ShopIndex(nickname: string): Promise<Tier2ShopEntry[] | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const val = await redis.get(shopKey(nickname))
    if (!val) return null
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function setTier2ShopIndex(nickname: string, entries: Tier2ShopEntry[]): Promise<void> {
  const redis = getRedis()
  if (!redis || entries.length === 0) return
  try {
    await redis.setex(shopKey(nickname), TIER2_SHOP_TTL_SEC, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

export async function getTier2ShopMeta(nickname: string): Promise<Record<string, unknown> | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const val = await redis.get(shopMetaKey(nickname))
    if (!val) return null
    return JSON.parse(val) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function setTier2ShopMeta(nickname: string, meta: Record<string, unknown>): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.setex(shopMetaKey(nickname), TIER2_SHOP_TTL_SEC, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

export async function getTier1Item(code: string): Promise<Tier1Item | null> {
  const redis = getRedis()
  if (!redis || !code.trim()) return null
  try {
    const val = await redis.get(itemKey(code))
    if (!val) return null
    return JSON.parse(val) as Tier1Item
  } catch {
    return null
  }
}

export async function setTier1Item(item: Tier1Item): Promise<void> {
  const redis = getRedis()
  if (!redis || !item.item_code?.trim()) return
  try {
    await redis.setex(itemKey(item.item_code), TIER1_ITEM_TTL_SEC, JSON.stringify(item))
  } catch {
    /* ignore */
  }
}

export function mergeTier1AndTier2(t1: Tier1Item, t2: Tier2ShopEntry): Record<string, unknown> {
  const price = t2.SALE_PRICE_INCLUSIVE
  const stock = t2.QUANTITY
  return {
    ITEM_CODE: t1.item_code,
    item_code: t1.item_code,
    item_key_words: t1.item_code,
    niki_code: t1.niki_code ?? "",
    NIKI_CODE: t1.niki_code ?? "",
    item_commercial_name: t1.item_name ?? "",
    item_name: t1.item_name ?? "",
    item_key_words_french: t1.item_french ?? t1.item_key_words_french ?? "",
    item_key_words_kinyarwanda: t1.IMITERERE ?? t1.item_key_words_kinyarwanda ?? "",
    item_keywords: t1.item_keywords ?? "",
    keywords_en: t1.keywords_en ?? "",
    learned_keywords: t1.learned_keywords ?? "",
    description: t1.DESCRIPTION ?? t1.description ?? "",
    famille: t2.FAMILLE ?? t1.FAMILLE ?? t1.famille ?? "",
    FAMILLE: t2.FAMILLE ?? t1.FAMILLE ?? t1.famille ?? "",
    image_url: t1.image_url,
    item_image_url: t1.image_url,
    selling_price: price,
    price: String(price),
    SALE_PRICE_INCLUSIVE: price,
    stock,
    QUANTITY: stock,
    item_packet: String(stock),
    in_stock: stock > 0,
    search_priority: t1.search_priority ?? null,
    contains_ingredient: t1.contains_ingredient ?? false,
    source: "tier-cache",
  }
}

export async function mergeShopFromTiers(index: Tier2ShopEntry[]): Promise<Record<string, unknown>[] | null> {
  const merged: Record<string, unknown>[] = []
  for (const t2 of index) {
    const t1 = await getTier1Item(t2.item_code)
    if (!t1) return null
    merged.push(mergeTier1AndTier2(t1, t2))
  }
  return merged
}

export function warmTier1FromProducts(products: Record<string, unknown>[]): void {
  void (async () => {
    for (const p of products) {
      const code = productItemCode(p)
      if (!code) continue
      const existing = await getTier1Item(code)
      if (existing) continue
      await setTier1Item(extractTier1FromProduct(p))
    }
  })().catch(() => {})
}

export function writeTierCachesFromJavaResponse(
  nickname: string,
  data: { ok?: boolean; sellers?: Array<Record<string, unknown>> },
): void {
  void (async () => {
    const sellers = data.sellers ?? []
    const allProducts: Record<string, unknown>[] = []
    for (const seller of sellers) {
      for (const p of (seller.products as Record<string, unknown>[] | undefined) ?? []) {
        allProducts.push(p)
        await setTier1Item(extractTier1FromProduct(p))
      }
    }
    const index = allProducts.map(extractTier2FromProduct).filter((e) => e.item_code)
    if (index.length > 0) {
      await setTier2ShopIndex(nickname, index)
    }
    if (sellers.length > 0) {
      const shell = { ...sellers[0] }
      delete shell.products
      await setTier2ShopMeta(nickname, {
        ok: data.ok ?? true,
        sellers: [shell],
        sellerShell: shell,
      })
    }
  })().catch(() => {})
}

export async function hydrateProductsWithTier1Sync(
  products: Record<string, unknown>[],
): Promise<void> {
  for (const p of products) {
    const code = productItemCode(p)
    if (!code) continue
    let cached = await getTier1Item(code)
    if (!cached) {
      cached = extractTier1FromProduct(p)
      await setTier1Item(cached)
    }
    Object.assign(p, mergeTier1AndTier2(cached, extractTier2FromProduct(p)))
  }
}

export async function hasTier2ShopIndex(nickname: string): Promise<boolean> {
  const index = await getTier2ShopIndex(nickname)
  return !!(index && index.length > 0)
}

export async function countTier1HitsForProducts(
  products: Record<string, unknown>[],
): Promise<{ hits: number; total: number }> {
  let hits = 0
  const total = products.length
  for (const p of products) {
    const code = productItemCode(p)
    if (!code) continue
    const cached = await getTier1Item(code)
    if (cached) hits++
  }
  return { hits, total }
}

export async function buildResponseFromTierCache(
  nickname: string,
): Promise<Record<string, unknown> | null> {
  const index = await getTier2ShopIndex(nickname)
  const meta = await getTier2ShopMeta(nickname)
  if (!index || index.length === 0 || !meta) return null
  const products = await mergeShopFromTiers(index)
  if (!products) return null
  const shell = (meta.sellerShell as Record<string, unknown>) ?? (meta.sellers as Record<string, unknown>[])?.[0]
  if (!shell) return null
  return {
    ok: meta.ok ?? true,
    sellers: [{ ...shell, products }],
  }
}
