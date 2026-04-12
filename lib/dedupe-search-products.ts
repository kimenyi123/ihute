/**
 * Collapse duplicate catalog lines from global search (same supplier + item code + selling price).
 * Redis often returns one row per lot; buyers should see one card when code and price match.
 * Non-expired sellable units are summed (aligned with Kaos fetchSuggestions / OrdersServlet).
 */

import { parseItemStateBatchExpiry } from "@/lib/item-state-display"
import { generalSellingPrice } from "@/lib/package-price"

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").replace(/[^\d.\-]/g, ""))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function emballageDivisor(p: Record<string, unknown>): number {
  const raw = p.item_emballage ?? p.ITEM_EMBALLAGE
  if (raw == null || raw === "") return 1
  const s = String(raw)
  if (/(RWF|FRW|USD|EUR|\$|FRF)/i.test(s)) return 1
  const n = num(raw, 0)
  return n > 0 ? n : 1
}

function sellableQty(p: Record<string, unknown>): number {
  const packet = num(p.item_packet ?? p.QUANTITY ?? p.stock ?? p.STOCK ?? 0)
  if (packet <= 0) return 0
  return packet / emballageDivisor(p)
}

function sellableQtyNonExpired(p: Record<string, unknown>): number {
  const raw = p.item_state ?? (p as { itemState?: string }).itemState ?? ""
  const { isExpired } = parseItemStateBatchExpiry(raw)
  if (isExpired) return 0
  return sellableQty(p)
}

/** NIKI / item code — same field family as `getNikiCodeFromSource`. */
export function searchProductItemCode(p: Record<string, unknown>): string {
  const c =
    p.item_key_words ??
    p.ITEM_CODE ??
    p.itemCode ??
    p.item_code ??
    p.niki_code ??
    p.NIKI_CODE
  return String(c ?? "").trim().toUpperCase()
}

export function searchProductSupplierKey(p: Record<string, unknown>): string {
  const account = String(
    p.supplier_account ??
      p.supplier_id ??
      p.ishyigaAccount ??
      p.SELLER_ID ??
      ""
  ).trim()
  if (account) return account
  const name = String(p.supplier_name ?? p.SELLER_NAMES ?? p.seller_name ?? "").trim()
  return name || "__unknown_supplier__"
}

export function searchProductSellingPrice(p: Record<string, unknown>): number {
  const raw =
    p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.UNITY_PRICE ?? p.price ?? 0
  return num(raw, 0)
}

function priceKey(price: number): string {
  return String(Math.round(price * 100) / 100)
}

function dedupeKey(p: Record<string, unknown>): string {
  return `${searchProductSupplierKey(p)}\x1e${searchProductItemCode(p)}\x1e${priceKey(searchProductSellingPrice(p))}`
}

function pickRepresentative(rows: Record<string, unknown>[]): Record<string, unknown> {
  let best = rows[0]
  let bestQty = sellableQtyNonExpired(best)
  for (let i = 1; i < rows.length; i++) {
    const q = sellableQtyNonExpired(rows[i])
    if (q > bestQty) {
      best = rows[i]
      bestQty = q
    }
  }
  return best
}

/** Shelf line price before merge — matches ProductCard / search `productLinePrice` semantics. */
function representativeCustomerLinePrice(rep: Record<string, unknown>): number {
  const fp = rep.final_selling_price
  if (fp != null && fp !== "") {
    const n =
      typeof fp === "number"
        ? fp
        : parseFloat(String(fp).replace(/[^\d.,-]/g, "").replace(",", "."))
    if (Number.isFinite(n) && n >= 0) return n
  }
  const base = searchProductSellingPrice(rep)
  return generalSellingPrice(base, rep.item_emballage ?? rep.ITEM_EMBALLAGE)
}

function mergeGroup(arr: Record<string, unknown>[]): Record<string, unknown> {
  /** Single row: never clobber item_emballage / final_selling_price (was forcing "1" and breaking × emballage). */
  if (arr.length <= 1) {
    return arr.length === 1 ? { ...arr[0] } : {}
  }
  const rep = pickRepresentative(arr)
  const preservedLine = representativeCustomerLinePrice(rep)
  const sumSellable = arr.reduce((s, p) => s + sellableQtyNonExpired(p), 0)
  const out: Record<string, unknown> = { ...rep }
  if (sumSellable > 0) {
    out.item_packet = sumSellable
    out.item_emballage = "1"
    /** After forcing emballage to 1, base×1 must not replace real shelf price (e.g. base 1.5 × 100 → 150 RWF). */
    out.selling_price = preservedLine
    out.final_selling_price = preservedLine
  }
  out.merged_lot_count = arr.length
  return out
}

/**
 * One row per (supplier, item code, selling price). Rows without a code are left in place (no merging).
 * Merged row: summed non-expired sellable qty, `item_emballage` "1", `merged_lot_count`.
 */
export function dedupeSearchProductsByItemCodeAndSellingPrice(
  products: unknown[]
): unknown[] {
  if (!Array.isArray(products) || products.length < 2) return products

  const rows = products.filter((p): p is Record<string, unknown> => p != null && typeof p === "object")

  const groups = new Map<string, Record<string, unknown>[]>()
  for (const p of rows) {
    if (!searchProductItemCode(p)) continue
    const k = dedupeKey(p)
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }

  const merged = new Map<string, Record<string, unknown>>()
  for (const [k, arr] of groups) {
    merged.set(k, mergeGroup(arr))
  }

  const seen = new Set<string>()
  const ordered: unknown[] = []
  for (const p of rows) {
    const rec = p
    if (!searchProductItemCode(rec)) {
      ordered.push(rec)
      continue
    }
    const k = dedupeKey(rec)
    if (seen.has(k)) continue
    seen.add(k)
    ordered.push(merged.get(k) ?? rec)
  }

  return ordered
}
