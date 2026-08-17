export type RatingItem = {
  code: string
  name: string
  /** Stable unique key for React lists (handles missing/duplicate codes). */
  key: string
}

type RawRatingItem = {
  code?: string
  name?: string
  itemCode?: string
  itemName?: string
  ITEM_CODE?: string
  ITEM_NAME?: string
  item_code?: string
  item_name?: string
  id?: string | number
  [key: string]: unknown
}

/** Normalize order line items for RatingModal (backend field names vary). */
export function normalizeRatingItems(items: RawRatingItem[] | null | undefined): RatingItem[] {
  if (!items?.length) return []

  const seen = new Map<string, number>()

  return items.map((raw, index) => {
    const code = String(
      raw.code ?? raw.itemCode ?? raw.ITEM_CODE ?? raw.item_code ?? raw.id ?? "",
    ).trim()
    const name =
      String(raw.name ?? raw.itemName ?? raw.ITEM_NAME ?? raw.item_name ?? "Item").trim() || "Item"

    const baseKey = code || `item-${index}`
    const duplicateCount = seen.get(baseKey) ?? 0
    seen.set(baseKey, duplicateCount + 1)
    const key = duplicateCount > 0 ? `${baseKey}-${duplicateCount}` : baseKey

    return {
      code: code || `__line_${index}`,
      name,
      key,
    }
  })
}
