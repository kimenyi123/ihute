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

/** Per-supplier stock-line / product count from browse or listSuppliers rows (Kaos). */
export function productCountFromSupplierRow(row: unknown): number {
  if (!row || typeof row !== "object") return 0
  const o = row as Record<string, unknown>
  const toFiniteNumber = (v: unknown): number | undefined => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const pc =
    toFiniteNumber(o.product_count) ??
    toFiniteNumber(o.productCount) ??
    toFiniteNumber(o.PRODUCT_COUNT) ??
    toFiniteNumber(o.items_count) ??
    toFiniteNumber(o.itemsCount) ??
    toFiniteNumber(o.ITEMS_COUNT)
  if (pc !== undefined && Number.isFinite(Number(pc))) {
    const n = Number(pc)
    return n >= 0 ? Math.round(n) : 0
  }
  const products = o.products
  if (Array.isArray(products)) return products.length
  return 0
}

/** Sum per-seller line counts (prefer {@code product_count} from Kaos; not sample {@code products.length}). */
export function sumProductsInListSuppliersPayload(rows: unknown[]): number {
  let n = 0
  for (const row of rows) {
    n += productCountFromSupplierRow(row)
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
