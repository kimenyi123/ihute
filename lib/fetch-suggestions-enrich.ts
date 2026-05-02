import { generalSellingPrice, resolveItemEmballageRaw } from "@/lib/package-price"

function extractNumericPrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = String(value ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

function hasUsableFinalSellingPrice(p: Record<string, unknown>): boolean {
  const v = p.final_selling_price
  if (v == null || v === "") return false
  const n =
    typeof v === "number"
      ? v
      : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."))
  return Number.isFinite(n) && n >= 0
}

/**
 * Customer-facing price for one catalog row: base `selling_price` × numeric `item_emballage`
 * (same rule as search page, cart, kiosk). Adds `final_selling_price` so API clients need not
 * duplicate {@link generalSellingPrice}.
 *
 * Does not overwrite a numeric `final_selling_price` already set by Kaos (avoids clashes after
 * dedupe or different parsing paths).
 */
export function enrichFetchSuggestionsProducts<T extends { products?: unknown[] }>(parsed: T): T {
  if (!parsed?.products || !Array.isArray(parsed.products)) return parsed
  for (const raw of parsed.products) {
    if (!raw || typeof raw !== "object") continue
    const p = raw as Record<string, unknown>
    if (hasUsableFinalSellingPrice(p)) continue
    const base =
      extractNumericPrice(p.selling_price) ||
      extractNumericPrice(p.SALE_PRICE_INCLUSIVE) ||
      extractNumericPrice(p.price) ||
      extractNumericPrice(p.UNITY_PRICE) ||
      0
    const emb = resolveItemEmballageRaw(p)
    p.final_selling_price = generalSellingPrice(base, emb)
  }
  return parsed
}
