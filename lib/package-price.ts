/**
 * Catalog pricing rule (Redis / Kaos / UI):
 * **final selling price (customer line unit) = `selling_price` × `item_emballage`**
 * where `selling_price` is the base catalog unit and `item_emballage` is the numeric package multiplier (≤0 or missing → 1).
 *
 * Package / packet multiplier from `item_emballage` (and DB variants).
 * Invalid, missing, or ≤ 0 → 1 so unit prices do not zero out.
 */
export function parsePackageMultiplier(raw: unknown): number {
  if (raw == null) return 1
  const cleaned = String(raw).replace(/,/g, "").replace(/[^\d.\-]/g, "").trim()
  if (!cleaned) return 1
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/**
 * Customer-facing **final** unit price: `selling_price` × `item_emballage` (same as Kaos line total per ordered unit).
 */
export function generalSellingPrice(
  baseUnitSellingPrice: number,
  itemEmballageRaw: unknown
): number {
  const b =
    typeof baseUnitSellingPrice === "number" && Number.isFinite(baseUnitSellingPrice)
      ? baseUnitSellingPrice
      : parseFloat(String(baseUnitSellingPrice ?? "").replace(/[^\d.-]/g, "")) || 0
  return b * parsePackageMultiplier(itemEmballageRaw)
}

/** Raw value to persist on cart lines / order payload (omit when empty). */
export function normalizeItemEmballageForCart(raw: unknown): string | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim()
  return s === "" ? undefined : s
}
