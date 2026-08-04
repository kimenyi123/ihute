/**
 * Sales velocity & ABC movement class (Pareto on units sold).
 *
 * Sales Velocity = Units Sold ÷ Days
 *
 * ABC thresholds (of total *units* among SKUs that sold — not % of catalog):
 *   A (Fast)   = SKUs that make up the first 80% of unit volume
 *   B (Medium) = next band until 95% of unit volume (~15% of volume)
 *   C (Slow)   = remaining ~5% of unit volume
 *
 * These are industry-style Pareto bands, not “average % of products”.
 * With few sold SKUs, most will land in A — that is expected.
 */

export const VELOCITY_LOOKBACK_DAYS = 30

/** Cumulative unit-volume cutoffs for A / B (rest = C). */
export const ABC_VOLUME_A_MAX = 0.8
export const ABC_VOLUME_B_MAX = 0.95

export type MovementClass = "A" | "B" | "C"

export type VelocityStats = {
  /** Units sold in the lookback window. */
  unitsSold: number
  /** Units per day over the lookback window. */
  salesVelocity: number
  /** A = fast, B = medium, C = slow (among SKUs with sales only). */
  movementClass: MovementClass | null
}

/** Sales Velocity = unitsSold / days */
export function salesVelocity(unitsSold: number, days = VELOCITY_LOOKBACK_DAYS): number {
  const u = Number(unitsSold)
  const d = Math.max(1, days)
  if (!Number.isFinite(u) || u <= 0) return 0
  return u / d
}

function unitsOf(product: Record<string, unknown>): number {
  const n = Number(product.totalSold ?? product.units_sold ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Pareto ABC on units sold within the given set.
 * SKUs with 0 sales get movementClass null (never label them Fast/Medium/Slow).
 */
export function assignAbcByUnitsSold(
  products: Record<string, unknown>[],
): Map<Record<string, unknown>, MovementClass | null> {
  const out = new Map<Record<string, unknown>, MovementClass | null>()
  for (const p of products) {
    out.set(p, null)
  }

  const withSales = products
    .map((p) => ({ p, u: unitsOf(p) }))
    .filter((x) => x.u > 0)
    .sort((a, b) => b.u - a.u)

  if (withSales.length === 0) return out

  const total = withSales.reduce((s, x) => s + x.u, 0)
  let cumulative = 0
  for (const { p, u } of withSales) {
    const before = cumulative
    cumulative += u
    let cls: MovementClass
    if (before < total * ABC_VOLUME_A_MAX) cls = "A"
    else if (before < total * ABC_VOLUME_B_MAX) cls = "B"
    else cls = "C"
    out.set(p, cls)
  }
  return out
}

/** Attach salesVelocity + movementClass. Zero-sales → movementClass null. */
export function enrichWithVelocityAndAbc<T extends Record<string, unknown>>(
  products: T[],
  days = VELOCITY_LOOKBACK_DAYS,
): (T & VelocityStats)[] {
  const abc = assignAbcByUnitsSold(products)
  return products.map((p) => {
    const unitsSold = unitsOf(p)
    return {
      ...p,
      unitsSold,
      salesVelocity: salesVelocity(unitsSold, days),
      movementClass: unitsSold > 0 ? abc.get(p) ?? null : null,
      totalSold: unitsSold > 0 ? unitsSold : p.totalSold,
    }
  })
}

export function compareByVelocityThenName(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const va = Number(a.salesVelocity ?? salesVelocity(unitsOf(a)))
  const vb = Number(b.salesVelocity ?? salesVelocity(unitsOf(b)))
  if (vb !== va) return vb - va
  const na = String(a.item_commercial_name ?? a.item_name ?? "").toLowerCase()
  const nb = String(b.item_commercial_name ?? b.item_name ?? "").toLowerCase()
  return na.localeCompare(nb)
}

/** A before B before C before unclassified; then velocity. */
export function compareByAbcThenVelocity(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const rank = (c: unknown) => (c === "A" ? 0 : c === "B" ? 1 : c === "C" ? 2 : 3)
  const d = rank(a.movementClass) - rank(b.movementClass)
  if (d !== 0) return d
  return compareByVelocityThenName(a, b)
}

export function movementClassLabel(c: MovementClass | null | undefined): string | null {
  if (c === "A") return "Fast-moving"
  if (c === "B") return "Medium-moving"
  if (c === "C") return "Slow-moving"
  return null
}

/** UI line: only when there were real sales (never "Slow-moving 0.0/day"). */
export function formatMovementBadge(
  movementClass: MovementClass | null | undefined,
  velocity: number | null | undefined,
  unitsSold?: number | null,
): string | null {
  const sold = Number(unitsSold ?? 0)
  const v = Number(velocity ?? 0)
  if (!(sold > 0) || !(v > 0)) return null
  const label = movementClassLabel(movementClass)
  if (!label) return null
  const rate = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)
  return `${label} · ${rate}/day`
}
