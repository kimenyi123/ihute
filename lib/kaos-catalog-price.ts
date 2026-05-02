import { parsePackageMultiplier } from "@/lib/package-price"

/**
 * Cart `price` is the customer-facing **line** unit (shelf price): catalog base × item_emballage when multiplier &gt; 1.
 * Kaos Redis / `validateStock` typically match rows on catalog **`selling_price`** (base per smallest unit).
 * Use this value as `unitPrice` in order/stock payloads when item_emballage &gt; 1 so Java finds the row; the servlet
 * should apply ITEM_EMBALLAGE when computing line totals (UNITY_PRICE × multiplier × qty).
 */
export function kaosCatalogBaseUnitPrice(
  cartLineUnitPrice: number,
  itemEmballageRaw: unknown,
): number {
  const mult = parsePackageMultiplier(itemEmballageRaw)
  if (!(mult > 1) || !Number.isFinite(cartLineUnitPrice) || cartLineUnitPrice <= 0) {
    return cartLineUnitPrice
  }
  const base = cartLineUnitPrice / mult
  return Number.isFinite(base) && base > 0 ? base : cartLineUnitPrice
}
