import { getProductImageCandidates, isConcreteProductImageUrl, NO_IMAGE_URL } from "@/lib/image-utils"
import { normalizeProductImagePublicUrl } from "@/lib/public-asset-url"

/** Pick best image URL and metadata to persist on cart lines (shop-with-me, barcode add, etc.). */
export function buildCartImageFields(product: Record<string, unknown>, itemCode: string) {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = product[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
    return ""
  }

  const niki = pick("item_key_words", "ITEM_CODE", "item_code") || itemCode
  const imageUrl = pick("image_url", "IMAGE_URL")
  const itemImageUrl = pick("item_image_url")
  const image = pick("image")

  const candidates = getProductImageCandidates({
    ...product,
    image_url: imageUrl || undefined,
    item_image_url: itemImageUrl || undefined,
    IMAGE_URL: imageUrl || undefined,
    image: image || undefined,
    item_key_words: niki,
    id: niki,
  })

  const rawResolved =
    candidates.find(isConcreteProductImageUrl) ??
    candidates.find((u) => u !== NO_IMAGE_URL) ??
    NO_IMAGE_URL

  const resolved =
    rawResolved.includes("/uploads/products/") || rawResolved.includes("/api/images/products/")
      ? normalizeProductImagePublicUrl(rawResolved)
      : rawResolved

  const famille = pick("famille", "FAMILLE", "category", "item_department")

  return {
    image: resolved,
    image_url: imageUrl || resolved,
    item_image_url: itemImageUrl || imageUrl || resolved,
    IMAGE_URL: imageUrl || resolved,
    item_key_words: niki,
    itemCode: niki,
    ...(famille ? { famille } : {}),
  }
}
