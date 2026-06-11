import type { MoodOption } from "@/lib/seller-mood-options"

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

export function productMatchesMoodOption(
  product: Record<string, unknown>,
  option: MoodOption
): boolean {
  const hay = getProductSearchHaystack(product)
  if (!hay) return option.categoryRegex.test("")
  if (option.excludeRegex?.test(hay)) return false
  return option.categoryRegex.test(hay)
}

export function filterProductsByMoodOption<T extends Record<string, unknown>>(
  products: T[],
  option: MoodOption
): T[] {
  return products.filter((p) => productMatchesMoodOption(p, option))
}
