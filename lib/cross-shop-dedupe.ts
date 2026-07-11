/** Cross-shop deduplication for global /search (fetchSuggestions) only. */



function nikiCodeOf(p: Record<string, unknown>): string {

  return String(p.NIKI_CODE ?? p.niki_code ?? "").trim().toUpperCase()

}



function priceOf(p: Record<string, unknown>): number {

  const raw =

    p.final_selling_price ??

    p.SALE_PRICE_INCLUSIVE ??

    p.selling_price ??

    p.price ??

    0

  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ""))

  return Number.isFinite(n) ? n : 0

}



function shopNicknameOf(p: Record<string, unknown>): string {

  return String(

    p.nickname ??

      p.NICKNAME ??

      p.seller_nickname ??

      p.supplier_nickname ??

      p.supplier_name ??

      p.supplier_account ??

      "",

  ).trim()

}



/**

 * Merge only when NIKI_CODE is present (POS canonical identity).

 * Excel rows without NIKI stay as separate per-shop cards.

 */

export function dedupeCrossShopByItemCode(products: unknown[]): unknown[] {

  if (!Array.isArray(products) || products.length <= 1) return products



  const rows = products.filter((p): p is Record<string, unknown> => p != null && typeof p === "object")

  const byNiki = new Map<string, Record<string, unknown>[]>()

  const noNiki: Record<string, unknown>[] = []



  for (const p of rows) {

    const niki = nikiCodeOf(p)

    if (!niki) {

      noNiki.push(p)

      continue

    }

    const list = byNiki.get(niki) ?? []

    list.push(p)

    byNiki.set(niki, list)

  }



  const out: unknown[] = []



  for (const group of byNiki.values()) {

    if (group.length <= 1) {

      out.push(group[0])

      continue

    }

    const sorted = [...group].sort((a, b) => priceOf(a) - priceOf(b))

    const primary = { ...sorted[0] }

    primary.shop_count = group.length

    primary.niki_merge = true

    primary.cheapest_shop_nickname = shopNicknameOf(primary) || undefined

    out.push(primary)

  }



  for (const p of noNiki) {

    out.push(p)

  }



  return out

}



export function logCrossShopDedupeDetails(products: unknown[], term: string): void {

  if (!term.trim() || !Array.isArray(products)) return

  const safeTerm = term.trim().replace(/"/g, "'")

  for (const raw of products) {

    if (!raw || typeof raw !== "object") continue

    const p = raw as Record<string, unknown>

    if (p.niki_merge !== true) continue

    const shopCount = p.shop_count

    if (typeof shopCount !== "number" || shopCount <= 1) continue

    const code = nikiCodeOf(p)

    const nick = shopNicknameOf(p) || "unknown"

    const price = priceOf(p)

    console.log(

      `[dedupe][global] term="${safeTerm}" niki_code=${code} shop_count=${shopCount} cheapest_shop=${nick} price=${price}`,

    )

  }

}

