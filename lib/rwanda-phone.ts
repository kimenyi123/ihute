/**
 * Normalize and validate Rwanda mobile numbers (E.164 +2507XXXXXXXX).
 * Accepts local 07…, 250…, or international +250… forms.
 */

const RW_MOBILE_E164 = /^\+2507\d{8}$/

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

/**
 * Same rules as Java {@code GrandmaBuyerDbHandler#normalizePhone} (DB `tel` column).
 */
export function normalizePhoneDigitsForAuth(raw: string): string {
  const d = digitsOnly(raw)
  if (!d) return ""
  if (d.length === 9 && (d.startsWith("7") || d.startsWith("8"))) return "250" + d
  return d
}

/** Returns E.164 like +250788123456, or null if not parseable as Rwandan mobile. */
export function normalizeRwandaMobileE164(input: string): string | null {
  const d = digitsOnly(input.trim())
  if (!d) return null
  if (d.startsWith("250") && d.length === 12 && d[3] === "7") return `+${d}`
  if (d.length === 10 && d.startsWith("0") && d[1] === "7") return `+250${d.slice(1)}`
  if (d.length === 9 && d.startsWith("7")) return `+250${d}`
  if (d.length === 12 && d.startsWith("2507")) return `+${d}`
  return null
}

export function isValidRwandaMobileE164(e164: string): boolean {
  return RW_MOBILE_E164.test(e164)
}
