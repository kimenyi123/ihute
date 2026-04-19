/**
 * Detects "top-up" style catalog lines (airtime, bundles, e-recharge, etc.).
 * Optional env (server): TOPUP_ITEM_CODES=comma codes, TOPUP_SECTORS=comma substrings,
 * TOPUP_LINE_REGEX=JS regex body against "code name sector".
 */

function splitList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const EXTRA_CODES = splitList(process.env.TOPUP_ITEM_CODES ?? process.env.NEXT_PUBLIC_TOPUP_ITEM_CODES)
const EXTRA_SECTORS = splitList(process.env.TOPUP_SECTORS ?? process.env.NEXT_PUBLIC_TOPUP_SECTORS)

export function isTopUpLineItem(it: Record<string, unknown>): boolean {
  const code = String(it.ITEM_CODE ?? it.itemCode ?? it.niki_code ?? "").trim().toLowerCase()
  const name = String(it.ITEM_NAME ?? it.itemName ?? it.name ?? "").trim().toLowerCase()
  const sector = String(
    it.SECTOR ?? it.sector ?? it.CATEGORY ?? it.category ?? it.ITEM_SECTOR ?? ""
  )
    .trim()
    .toLowerCase()

  if (code && EXTRA_CODES.length && EXTRA_CODES.includes(code)) return true

  if (sector && EXTRA_SECTORS.length) {
    for (const s of EXTRA_SECTORS) {
      if (!s) continue
      if (sector === s || sector.includes(s)) return true
    }
  }

  const hay = `${code} ${name} ${sector}`
  const custom = process.env.TOPUP_LINE_REGEX ?? process.env.NEXT_PUBLIC_TOPUP_LINE_REGEX
  if (custom?.trim()) {
    try {
      if (new RegExp(custom.trim(), "i").test(hay)) return true
    } catch {
      /* ignore invalid regex */
    }
  }

  if (/\btop[\s_-]?up\b/i.test(hay)) return true
  if (/\bairtime\b/i.test(hay)) return true
  if (/\b(data|voice)\s*bundle\b/i.test(hay)) return true
  if (/\be[\s_-]?recharge\b/i.test(hay)) return true
  if (/\b(mtn|airtel|tigo|halotel)\b.*\b(airtime|bundle|credit)\b/i.test(hay)) return true
  if (/\b(airtime|bundle|credit)\b.*\b(mtn|airtel|tigo|halotel)\b/i.test(hay)) return true

  return false
}

export function lineTotalRwf(it: Record<string, unknown>): number {
  const qty = Number(it.quantity ?? it.QUANTITY ?? it.qty ?? it.QTY ?? 0)
  const unitPrice = Number(
    it.UNITY_PRICE ?? it.unitPrice ?? it.UNIT_PRICE ?? it.price ?? it.REQUEST_PRICE ?? 0
  )
  const totalFromPayload = Number(
    it.TOTAL_WITH_VAT ?? it.TOTAL ?? it.total ?? it.totalWithVat ?? NaN
  )
  if (!Number.isNaN(totalFromPayload) && totalFromPayload > 0) return totalFromPayload
  return qty * unitPrice
}
