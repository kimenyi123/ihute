/**
 * Merge multiple Redis/catalog rows that share the same `item_key_words` / itemCode
 * (different lots: `lot`, `item_state`, `item_packet`, prices) into one buyer-facing
 * product with optional lot breakdown.
 *
 * Use on shop-with-me, search, discover — anywhere the raw array is one row per lot.
 */

import { parseItemStateBatchExpiry } from "@/lib/item-state-display"

export type CatalogLine = Record<string, unknown> & {
  item_key_words?: string
  ITEM_CODE?: string
  itemCode?: string
  item_commercial_name?: string
  item_packet?: string | number
  selling_price?: string | number
  cost_price?: string | number
  item_emballage?: string | number
  item_state?: string
  lot?: string
}

export type CatalogLotVariant = {
  /** Stable id for cart / order line (include in payload so backend can pick lot) */
  lineId: string
  lot: string | null
  item_state: string | null
  item_packet: number
  selling_price: number
  cost_price: number
  item_emballage: string
  expiryAt: Date | null
  expiryLabel: string | null
  isExpired: boolean
  expiryRaw?: string | null
  /** No valid calendar date for Ex (e.g. 31/11) — label still shows encoded dd/mm/yy */
  expiryUncertain: boolean
}

export type MergedCatalogProduct = {
  itemCode: string
  name: string
  famille?: string
  /** Sum of sellable units across non-expired lots (adjust policy as needed) */
  totalAvailableQty: number
  /** Only lots that are not expired */
  activeLots: CatalogLotVariant[]
  /** Expired lots (optional: hide from total, show in “details”) */
  expiredLots: CatalogLotVariant[]
  allLots: CatalogLotVariant[]
  minPrice: number
  maxPrice: number
  /** “From 230 RWF” vs single price */
  priceDisplayHint: "single" | "range"
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").replace(/[^\d.\-]/g, ""))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function itemCodeOf(p: CatalogLine): string {
  const c =
    (p.item_key_words as string) ||
    (p.ITEM_CODE as string) ||
    (p.itemCode as string) ||
    ""
  return String(c).trim()
}

function emballageDivisor(p: CatalogLine): number {
  const raw = p.item_emballage
  if (raw == null || raw === "") return 1
  const s = String(raw)
  if (/(RWF|FRW|USD|EUR|\$|FRF)/i.test(s)) return 1
  const n = num(raw, 0)
  return n > 0 ? n : 1
}

/**
 * One raw API row → variant (sellable qty = item_packet / item_emballage when packet > 0).
 */
export function catalogLineToVariant(p: CatalogLine, index: number): CatalogLotVariant {
  const code = itemCodeOf(p)
  const packet = num(p.item_packet, 0)
  const div = emballageDivisor(p)
  const qty = packet > 0 ? packet / div : 0
  const state = p.item_state != null ? String(p.item_state).trim() : ""
  const parsed = parseItemStateBatchExpiry(state)
  const lot =
    (p.lot != null && String(p.lot).trim() !== "" ? String(p.lot).trim() : null) ??
    parsed.batch ??
    null
  const lineId = lot ? `${code}::${lot}` : `${code}::#${index}`

  return {
    lineId,
    lot,
    item_state: state || null,
    item_packet: qty,
    selling_price: num(p.selling_price, 0),
    cost_price: num(p.cost_price, 0),
    item_emballage: String(p.item_emballage ?? "1"),
    expiryAt: parsed.expiryAt,
    expiryLabel: parsed.expiryLabel,
    isExpired: parsed.isExpired,
    expiryRaw: parsed.expiryRaw ?? null,
    expiryUncertain: Boolean(parsed.exDdMmYyEncoded && !parsed.expiryAt),
  }
}

/**
 * Group raw catalog rows by `item_key_words` and compute aggregates for buyer UI.
 */
export function mergeCatalogLinesByItemCode(lines: CatalogLine[]): MergedCatalogProduct[] {
  const byCode = new Map<string, CatalogLine[]>()
  for (const p of lines) {
    const code = itemCodeOf(p)
    if (!code) continue
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(p)
  }

  const out: MergedCatalogProduct[] = []

  for (const [itemCode, group] of byCode) {
    const variants = group.map((row, i) => catalogLineToVariant(row, i))
    const activeLots = variants.filter((v) => !v.isExpired)
    const expiredLots = variants.filter((v) => v.isExpired)
    const prices = variants.map((v) => v.selling_price).filter((x) => x > 0)
    const minPrice = prices.length ? Math.min(...prices) : 0
    const maxPrice = prices.length ? Math.max(...prices) : 0
    const totalAvailableQty = activeLots.reduce((s, v) => s + v.item_packet, 0)

    const first = group[0]
    const name =
      String(
        first.item_commercial_name ||
          first.item_key_words_kinyarwanda ||
          first.item_key_words ||
          itemCode
      ).trim() || itemCode

    out.push({
      itemCode,
      name,
      famille: first.famille != null ? String(first.famille) : undefined,
      totalAvailableQty,
      activeLots,
      expiredLots,
      allLots: variants,
      minPrice,
      maxPrice,
      priceDisplayHint: minPrice > 0 && maxPrice > 0 && minPrice !== maxPrice ? "range" : "single",
    })
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}
