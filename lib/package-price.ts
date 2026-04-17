/**
 * Catalog pricing rule (Redis / Kaos / UI):
 * **final selling price (customer line unit) = `selling_price` × `item_emballage`**
 * where `selling_price` is the base catalog unit and `item_emballage` is the numeric package multiplier (≤0 or missing → 1).
 *
 * **Sellable stock (one Redis row):** `item_packet / item_emballage` — `item_packet` is inventory in smallest
 * units on the line; `item_emballage` is how many of those units form one sellable pack. Same rule as Kaos
 * `computeRedisSellableUnits` (excluding expiry).
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

function parsePacketQuantity(raw: unknown): number {
  if (raw == null) return 0
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : parseFloat(String(raw).replace(/,/g, "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Sellable quantity for one catalog row: **`item_packet ÷ item_emballage`** (multiplier missing → 1).
 * Do not confuse `item_packet` with `item_emballage`: packet = raw qty, emballage = pack size divisor.
 */
export function sellableStockFromPacketEmballage(
  itemPacketRaw: unknown,
  itemEmballageRaw: unknown
): number {
  const packet = parsePacketQuantity(itemPacketRaw)
  if (packet <= 0) return 0
  return packet / parsePackageMultiplier(itemEmballageRaw)
}

/** Raw value to persist on cart lines / order payload (omit when empty). */
export function normalizeItemEmballageForCart(raw: unknown): string | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim()
  return s === "" ? undefined : s
}

/** Keys used for package multiplier (`item_packet` is raw inventory qty, not the multiplier). */
const ITEM_EMBALLAGE_FIELD_KEYS: readonly string[] = [
  "item_emballage",
  "ITEM_EMBALLAGE",
  "itemEmballage",
  "ItemEmballage",
  "emballage",
  "EMBALLAGE",
  /** Common aliases in exports / Java DTOs */
  "package",
  "PACKAGE",
  "ITEM_PACKAGE",
  "item_pack",
  "PACK_SIZE",
]

function emballageFromObject(o: Record<string, unknown>): unknown {
  for (const k of ITEM_EMBALLAGE_FIELD_KEYS) {
    const v = o[k]
    if (v != null && String(v).trim() !== "") return v
  }
  return undefined
}

/**
 * First non-empty `item_emballage` field across Redis / Java / DB shapes.
 * Also checks nested `data` / `product` (some APIs wrap rows).
 */
export function resolveItemEmballageRaw(p: unknown): unknown {
  if (p == null || typeof p !== "object") return undefined
  const o = p as Record<string, unknown>
  const direct = emballageFromObject(o)
  if (direct != null) return direct
  for (const nest of ["data", "product"] as const) {
    const inner = o[nest]
    if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
      const v = emballageFromObject(inner as Record<string, unknown>)
      if (v != null) return v
    }
  }
  return undefined
}

/** Skip `null` / `undefined` and empty-string fields so `"" ?? price` does not win. */
function pickFirstPresentField(
  p: Record<string, unknown>,
  keys: readonly string[]
): unknown {
  for (const k of keys) {
    const v = p[k]
    if (v == null) continue
    if (typeof v === "string" && v.trim() === "") continue
    return v
  }
  return 0
}

/** Base unit catalog price: `price` is the same meaning as `selling_price` when both exist. */
const SELLING_BASE_KEYS: readonly string[] = [
  "selling_price",
  "price",
  "UNITY_PRICE",
  "SALE_PRICE_INCLUSIVE",
]

const COST_BASE_KEYS: readonly string[] = [
  "cost_price",
  "cost",
  "COST_PRICE_INCLUSIVE",
  "costPrice",
]

/** Customer line selling total for one catalog row (same as search / ProductCard). */
export function lineSellingPriceFromProductRow(p: Record<string, unknown>): number {
  const baseRaw = pickFirstPresentField(p, SELLING_BASE_KEYS)
  return generalSellingPrice(baseRaw as number, resolveItemEmballageRaw(p))
}

/** Line cost when cost fields are per base unit (× same emballage as selling). */
export function lineCostPriceFromProductRow(p: Record<string, unknown>): number {
  const baseRaw = pickFirstPresentField(p, COST_BASE_KEYS)
  return generalSellingPrice(baseRaw as number, resolveItemEmballageRaw(p))
}
