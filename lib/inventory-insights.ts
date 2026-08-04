/**
 * Inventory insight lists for the supplier dashboard:
 * fast movers, slow / stagnant stock, and restock recommendations.
 * Built from catalog stock + 30-day order sales (no dedicated backend API).
 */

import {
  VELOCITY_LOOKBACK_DAYS,
  enrichWithVelocityAndAbc,
  compareByVelocityThenName,
  type MovementClass,
} from "@/lib/sales-velocity"
import { lookupUnitsSold } from "@/lib/order-sales-lookup"

export const RESTOCK_TARGET_DAYS = 14
export const RESTOCK_LOW_COVER_DAYS = 7
export const INSIGHT_LIST_LIMIT = 8

export type InventoryInsightItem = {
  itemCode: string
  name: string
  stock: number
  unitsSold: number
  salesVelocity: number
  movementClass: MovementClass | null
  /** Days of cover at current velocity; Infinity when velocity is 0. */
  daysCover: number
  /** Suggested units to order to reach RESTOCK_TARGET_DAYS of cover. */
  suggestedQty: number
}

function productName(p: Record<string, unknown>): string {
  return String(
    p.item_commercial_name ?? p.itemName ?? p.ITEM_NAME ?? p.item_name ?? "—",
  ).trim() || "—"
}

function productCode(p: Record<string, unknown>): string {
  return String(
    p.ITEM_CODE ?? p.itemCode ?? p.item_code ?? p.item_key_words ?? "",
  )
    .trim()
    .toUpperCase()
}

function productStock(p: Record<string, unknown>): number {
  const n = Number(p.stock ?? p.STOCK ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function daysCover(stock: number, velocity: number): number {
  if (!(velocity > 0)) return Number.POSITIVE_INFINITY
  return stock / velocity
}

function suggestedRestockQty(
  stock: number,
  velocity: number,
  targetDays = RESTOCK_TARGET_DAYS,
): number {
  if (!(velocity > 0)) return 0
  const need = Math.ceil(velocity * targetDays - stock)
  return need > 0 ? need : 0
}

/** Normalize catalog rows with 30d units sold for ABC / velocity. */
export function enrichCatalogForInsights(
  products: Record<string, unknown>[],
  orderSalesByCode: Record<string, number> | Map<string, number>,
  days = VELOCITY_LOOKBACK_DAYS,
): (Record<string, unknown> & {
  unitsSold: number
  salesVelocity: number
  movementClass: MovementClass | null
  stock: number
})[] {
  const withSold = products.map((p) => {
    const sold = lookupUnitsSold(p, orderSalesByCode)
    return {
      ...p,
      ITEM_CODE: productCode(p) || p.ITEM_CODE,
      item_commercial_name: productName(p),
      totalSold: sold > 0 ? sold : Number(p.totalSold ?? 0) || 0,
      stock: productStock(p),
    }
  })
  return enrichWithVelocityAndAbc(withSold, days).map((p) => ({
    ...p,
    stock: productStock(p),
  }))
}

function toInsight(
  p: Record<string, unknown> & {
    unitsSold: number
    salesVelocity: number
    movementClass: MovementClass | null
    stock: number
  },
): InventoryInsightItem {
  const stock = Number(p.stock ?? 0)
  const velocity = Number(p.salesVelocity ?? 0)
  return {
    itemCode: productCode(p),
    name: productName(p),
    stock,
    unitsSold: Number(p.unitsSold ?? 0),
    salesVelocity: velocity,
    movementClass: p.movementClass,
    daysCover: daysCover(stock, velocity),
    suggestedQty: suggestedRestockQty(stock, velocity),
  }
}

/** Top sellers by 30d velocity (ABC Fast, or highest velocity fallback). */
export function buildFastMovers(
  enriched: ReturnType<typeof enrichCatalogForInsights>,
  limit = INSIGHT_LIST_LIMIT,
): InventoryInsightItem[] {
  const fast = enriched.filter((p) => p.movementClass === "A" && p.unitsSold > 0)
  const pool = fast.length > 0 ? fast : enriched.filter((p) => p.unitsSold > 0)
  return [...pool]
    .sort(compareByVelocityThenName)
    .slice(0, limit)
    .map(toInsight)
}

/**
 * Slow / stagnant: in-stock SKUs with zero or bottom-band sales.
 * Prefer dead stock (sold 0) sorted by stock qty; then ABC Slow.
 */
export function buildSlowMovers(
  enriched: ReturnType<typeof enrichCatalogForInsights>,
  limit = INSIGHT_LIST_LIMIT,
): InventoryInsightItem[] {
  const stagnant = enriched
    .filter((p) => p.stock > 0 && !(p.unitsSold > 0))
    .sort((a, b) => b.stock - a.stock)

  const slowSold = enriched
    .filter((p) => p.movementClass === "C" && p.unitsSold > 0 && p.stock > 0)
    .sort((a, b) => a.salesVelocity - b.salesVelocity || b.stock - a.stock)

  const seen = new Set<string>()
  const out: InventoryInsightItem[] = []
  for (const p of [...stagnant, ...slowSold]) {
    const code = productCode(p) || productName(p)
    if (seen.has(code)) continue
    seen.add(code)
    out.push(toInsight(p))
    if (out.length >= limit) break
  }
  return out
}

/**
 * Restock when fast/high velocity and stock is 0, low cover (<7d), or ≤10 units.
 * Sorted: out-of-stock first, then lowest days of cover.
 */
export function buildRestockRecommendations(
  enriched: ReturnType<typeof enrichCatalogForInsights>,
  limit = INSIGHT_LIST_LIMIT,
): InventoryInsightItem[] {
  const candidates = enriched
    .filter((p) => p.unitsSold > 0 && p.salesVelocity > 0)
    .filter((p) => {
      const cover = daysCover(p.stock, p.salesVelocity)
      return (
        p.stock === 0 ||
        p.stock <= 10 ||
        cover < RESTOCK_LOW_COVER_DAYS ||
        (p.movementClass === "A" && cover < RESTOCK_TARGET_DAYS)
      )
    })
    .map(toInsight)
    .filter((p) => p.suggestedQty > 0 || p.stock === 0)
    .sort((a, b) => {
      const aOut = a.stock === 0 ? 0 : 1
      const bOut = b.stock === 0 ? 0 : 1
      if (aOut !== bOut) return aOut - bOut
      const ca = Number.isFinite(a.daysCover) ? a.daysCover : 1e9
      const cb = Number.isFinite(b.daysCover) ? b.daysCover : 1e9
      if (ca !== cb) return ca - cb
      return b.salesVelocity - a.salesVelocity
    })

  return candidates.slice(0, limit)
}
