/**
 * Replace backend item codes in order error text with cart line names (customer-facing).
 * e.g. "Insufficient stock for item MEDSERI00869" → uses commercial name from cart.
 */

export type OrderErrorCartLine = {
  name?: string
  itemCode?: string
  item_key_words?: string
  id?: string
}

function lineCodes(it: OrderErrorCartLine): { code: string; name: string }[] {
  const raw =
    String(it.itemCode ?? "").trim() ||
    String(it.item_key_words ?? "").trim() ||
    String(it.id ?? "").trim()
  if (!raw) return []
  const stripped = raw.replace(/__p\d+$/i, "")
  const name = String(it.name ?? "").trim() || stripped
  const out: { code: string; name: string }[] = []
  if (stripped.length >= 3) out.push({ code: stripped, name })
  if (raw !== stripped && raw.length >= 3) out.push({ code: raw, name })
  return out
}

export function orderErrorMessageWithProductNames(
  message: string,
  lines: OrderErrorCartLine[],
): string {
  if (!message?.trim() || !lines.length) return message

  const pairs: { code: string; name: string }[] = []
  for (const it of lines) {
    for (const p of lineCodes(it)) pairs.push(p)
  }
  if (pairs.length === 0) return message

  pairs.sort((a, b) => b.code.length - a.code.length)
  const seen = new Set<string>()
  let out = message
  for (const { code, name } of pairs) {
    const upper = code.toUpperCase()
    if (seen.has(upper)) continue
    seen.add(upper)
    const esc = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    out = out.replace(new RegExp(esc, "gi"), name)
  }
  return out
}
