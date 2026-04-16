import { unitMeaningfulForDisplay } from "@/lib/product-unit-display"

/**
 * `item_packet` / `unit` from Redis/API is often a stock count (e.g. "40", "24.0"), not a customer-facing unit.
 * Only show alongside price when it looks like a real unit (pcs, kg, 500ml, etc.).
 * Catalog `item_emballage` is sometimes stored as "/pcs" — strip a leading slash for display.
 */
export function displayUnitForPrice(unit?: string | null): string | null {
  if (unit == null) return null
  const normalized = String(unit).trim().replace(/^\/+/, "").trim()
  if (!unitMeaningfulForDisplay(normalized)) return null
  return normalized
}

function isNumericEmballageOnly(s: string): boolean {
  const t = s.replace(/,/g, "").trim()
  return /^-?\d+(\.\d+)?$/.test(t)
}

/** Redis/API sometimes appends currency to `item_emballage` (e.g. "1.0 RWF") — strip before parsing. */
function stripCurrencyNoiseFromEmballage(raw: string): string {
  return raw
    .replace(/\b(RWF|Frw|RF|FRW|USD|EUR)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Bare `pcs` / `pc` (e.g. from `/pcs` in Redis) → `1 pcs` so price lines never show `(pcs)` without a count. */
function normalizeBarePieceSuffix(label: string | null): string | null {
  if (label == null) return "1 pcs"
  const t = label.trim()
  if (/^(pcs|pc)$/i.test(t)) return "1 pcs"
  return label
}

/**
 * Same wording as product cards: numeric `item_emballage` → `N pcs`; text units use `displayUnitForPrice` (e.g. `/pcs` → `1 pcs`).
 * Missing or empty raw defaults to **`1 pcs`** (matches pack multiplier default of 1).
 */
export function itemEmballageDisplaySuffix(raw?: string | null): string | null {
  if (raw == null || String(raw).trim() === "") return "1 pcs"
  const s = stripCurrencyNoiseFromEmballage(String(raw).trim())
  if (!s) return "1 pcs"
  if (isNumericEmballageOnly(s)) {
    const n = parseFloat(s.replace(/,/g, ""))
    if (!Number.isFinite(n) || n <= 0) {
      return normalizeBarePieceSuffix(displayUnitForPrice(s))
    }
    return Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9
      ? `${Math.round(n)} pcs`
      : `${n} pcs`
  }
  return normalizeBarePieceSuffix(displayUnitForPrice(s))
}

/**
 * Supplier "Package" column: multiplier + `pcs` when numeric, else unit text.
 */
export function formatItemEmballagePackageCell(raw: unknown): string {
  if (raw == null) return "1 pcs"
  const s = stripCurrencyNoiseFromEmballage(String(raw).trim())
  if (s === "") return "1 pcs"
  if (isNumericEmballageOnly(s)) {
    const n = parseFloat(s.replace(/,/g, ""))
    if (!Number.isFinite(n) || n <= 0) return s
    const qtyStr =
      Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9
        ? String(Math.round(n))
        : String(n)
    return `${qtyStr} pcs`
  }
  return displayUnitForPrice(s) ?? s
}

/** Supplier tables: show `item_emballage` multiplier only (no `pcs` suffix). */
export function formatItemEmballageMultiplierOnly(raw: unknown): string {
  if (raw == null) return "1"
  const s = stripCurrencyNoiseFromEmballage(String(raw).trim())
  if (s === "") return "1"
  if (isNumericEmballageOnly(s)) {
    const n = parseFloat(s.replace(/,/g, ""))
    if (!Number.isFinite(n) || n <= 0) return s
    return Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9
      ? String(Math.round(n))
      : String(n)
  }
  return displayUnitForPrice(s) ?? s
}

export const DEFAULT_CART_CURRENCY = "RWF"
