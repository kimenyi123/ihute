import { digitsOnly, normalizePhoneDigitsForAuth } from "@/lib/rwanda-phone"

/** Normalize toward 250 + 9 digits (12 total) for Rwanda MoMo lines */
export function normalizeRwMobileMoneyPhone(raw: string): string {
  const d = digitsOnly(raw.trim())
  if (!d) return ""
  if (d.length === 12 && d.startsWith("250")) return d
  const viaAuth = normalizePhoneDigitsForAuth(raw)
  if (viaAuth.length === 12 && viaAuth.startsWith("250")) return viaAuth
  if (d.length === 10 && d.startsWith("0") && /^07|08|03|02/.test(d.slice(0, 3))) return `250${d.slice(1)}`
  if (d.length === 9 && /^7|3|2/.test(d[0] ?? "")) return `250${d}`
  return d
}

/** MTN (07x) & Airtel (072/073): 12-digit national mobile after 250 */
export function isValidRwMobileMoneyPhone(normalized: string): boolean {
  return /^250\d{9}$/.test(normalized)
}

export function validatePositiveAmountRwf(n: number): boolean {
  return Number.isFinite(n) && n >= 100 && n <= 50_000_000
}

export function maskPhoneForDisplay(normalized: string): string {
  if (normalized.length < 8) return "***"
  return `***${normalized.slice(-4)}`
}
