/**
 * Merge duplicate order lines (same product + unit price) into one row with summed qty.
 * Table-command lines with different ORDERED_BY keep a joined "who ordered" label.
 */

export type AggregateableLine = {
  name?: string
  ITEM_NAME?: string
  itemCode?: string | null
  ITEM_CODE?: string | null
  code?: string | null
  qty?: number
  QUANTITY?: number
  unitPrice?: number
  UNITY_PRICE?: number
  REQUEST_PRICE?: number
  amount?: number
  unit?: string
  UNIT?: string
  orderedBy?: string | null
  ORDERED_BY?: string | null
  [key: string]: unknown
}

function lineName(line: AggregateableLine): string {
  return String(line.name || line.ITEM_NAME || "Item").trim() || "Item"
}

function lineCode(line: AggregateableLine): string {
  return String(line.ITEM_CODE || line.itemCode || line.code || "").trim().toUpperCase()
}

function lineUnitPrice(line: AggregateableLine): number {
  const unity = Number(line.UNITY_PRICE ?? line.unitPrice ?? 0)
  const request = Number(line.REQUEST_PRICE ?? 0)
  if (unity > 0) return unity
  if (request > 0) return request
  return Number(line.unitPrice || 0) || 0
}

function lineQty(line: AggregateableLine): number {
  const q = Number(line.qty ?? line.QUANTITY ?? 0)
  return Number.isFinite(q) && q > 0 ? q : 0
}

function mergeKey(line: AggregateableLine): string {
  const code = lineCode(line)
  const price = lineUnitPrice(line)
  if (code) return `${code}|${price}`
  return `${lineName(line).toLowerCase()}|${price}`
}

/**
 * Collapse identical products into one line; qty and amount are summed.
 */
export function aggregateOrderItemsByCodeAndPrice<T extends AggregateableLine>(
  lines: T[],
): T[] {
  if (!Array.isArray(lines) || lines.length <= 1) return lines

  const order: string[] = []
  const map = new Map<string, T & { qty: number; unitPrice: number; amount: number }>()

  for (const raw of lines) {
    const qty = lineQty(raw)
    if (!(qty > 0)) continue
    const unitPrice = lineUnitPrice(raw)
    const key = mergeKey(raw)
    const existing = map.get(key)
    if (!existing) {
      order.push(key)
      const name = lineName(raw)
      const code = lineCode(raw)
      const orderedBy = String(raw.orderedBy || raw.ORDERED_BY || "").trim()
      map.set(key, {
        ...raw,
        name,
        ITEM_NAME: name,
        ITEM_CODE: code || (raw.ITEM_CODE as string) || undefined,
        itemCode: code || (raw.itemCode as string) || undefined,
        code: code || (raw.code as string) || undefined,
        qty,
        QUANTITY: qty,
        unitPrice,
        UNITY_PRICE: unitPrice,
        UNIT_PRICE: unitPrice,
        amount: qty * unitPrice,
        unit: (raw.unit || raw.UNIT) as string | undefined,
        UNIT: (raw.UNIT || raw.unit) as string | undefined,
        orderedBy: orderedBy || undefined,
        ORDERED_BY: orderedBy || undefined,
      })
      continue
    }

    existing.qty += qty
    existing.QUANTITY = existing.qty
    existing.amount = existing.qty * existing.unitPrice
    const who = String(raw.orderedBy || raw.ORDERED_BY || "").trim()
    if (who) {
      const prev = String(existing.orderedBy || existing.ORDERED_BY || "").trim()
      const parts = new Set(
        prev
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      parts.add(who)
      const joined = [...parts].join(", ")
      existing.orderedBy = joined
      existing.ORDERED_BY = joined
    }
  }

  return order.map((k) => map.get(k)!) as T[]
}
