/** Normalize sector shop-list JSON (array or { sellers | data }) — `/api/sector-list-suppliers` or legacy fetchSuggestions. */
export function normalizeListSuppliersPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (Array.isArray((o as { sellers?: unknown }).sellers)) return (o as { sellers: unknown[] }).sellers
    if (Array.isArray((o as { data?: unknown }).data)) return (o as { data: unknown[] }).data
  }
  return []
}

/** Sum per-seller line counts (prefer {@code product_count} from Kaos; not sample {@code products.length}). */
export function sumProductsInListSuppliersPayload(rows: unknown[]): number {
  let n = 0
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const pc =
      typeof o.product_count === "number"
        ? o.product_count
        : typeof o.productCount === "number"
          ? o.productCount
          : typeof o.PRODUCT_COUNT === "number"
            ? o.PRODUCT_COUNT
            : undefined
    if (pc !== undefined && Number.isFinite(pc) && pc >= 0) {
      n += Math.round(pc)
      continue
    }
    const products = o.products
    if (Array.isArray(products)) n += products.length
  }
  return n
}

/** Kaos {@code GET .../fetchSuggestions?sectorStats=pharmacy} — full DB shop + stock-line counts (no servlet sample limit). */
export async function fetchSectorStatsFromApi(sectorId: string): Promise<{ shops: number; items: number }> {
  const sid = sectorId.trim().toLowerCase()
  if (!sid) return { shops: 0, items: 0 }
  const debugSql =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SECTOR_STATS_DEBUG === "1"
  const url = `/api/fetchSuggestions?sectorStats=${encodeURIComponent(sid)}${debugSql ? "&debugSql=1" : ""}`
  const r = await fetch(url, { cache: "no-store" })
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
  if (!j || typeof j !== "object") {
    return { shops: 0, items: 0 }
  }
  const shops = Number(j.shops)
  const items = Number(j.items)
  const s = Number.isFinite(shops) ? Math.max(0, Math.floor(shops)) : 0
  const it = Number.isFinite(items) ? Math.max(0, Math.floor(items)) : 0
  if (!r.ok) {
    return { shops: s, items: it }
  }
  return { shops: s, items: it }
}
