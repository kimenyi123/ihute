/** Rwanda MSISDN for UrubutoPay wallet (MTN / Airtel). Urubuto expects 12 digits, e.g. 250788123456 */

export function normalizeUrubutoPhone(raw?: string | null): string {
  const digits = (raw ?? "").replace(/\D/g, "")
  if (!digits) return ""
  let d = digits
  if (d.startsWith("00")) d = d.slice(2)
  if (d.length === 10 && d.startsWith("0")) d = `250${d.slice(1)}`
  if (d.length === 9 && d.startsWith("7")) d = `250${d}`
  if (d.startsWith("250") && d.length >= 12) return d.slice(0, 12)
  return ""
}

export function isValidUrubutoMtnOrAirtel(normalized: string): boolean {
  if (normalized.length !== 12 || !normalized.startsWith("250")) return false
  const local = normalized.slice(3, 5)
  return local === "78" || local === "79" || local === "72" || local === "73"
}

export function urubutoPhoneHint(): string {
  return "Use MTN (078/079) or Airtel (072/073). You can type 0788123456, +250788123456, or 250788123456"
}
