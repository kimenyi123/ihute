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
  if (d.length === 10 && d[0] === "0" && (d[1] === "7" || d[1] === "8")) return "250" + d.slice(1)
  return d
}

/** Login id sent to Java: keep real emails intact; only normalize bare phone numbers. */
export function normalizeLoginIdentifierForJava(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (t.includes("@")) return t
  return normalizePhoneDigitsForAuth(t) || t
}

export type LoginChannel = "email" | "phone" | "auto"

/** Build Java login identifiers — channel keeps Grandma (phone) separate from ihute web (email). */
export function buildLoginCandidates(raw: string, channel: LoginChannel = "auto"): string[] {
  const t = raw.trim()
  if (!t) return []

  if (channel === "email") {
    return t.includes("@") ? [t] : []
  }

  if (channel === "phone") {
    if (t.includes("@")) return []
    const normalized = normalizePhoneDigitsForAuth(t) || t
    return Array.from(new Set(rwJavaLoginIdentifiers(normalized).filter(Boolean)))
  }

  const normalizedLogin = normalizeLoginIdentifierForJava(t)
  return Array.from(new Set(rwJavaLoginIdentifiers(normalizedLogin).filter(Boolean)))
}

/** Grandma buyer vs seller synthetic emails (see CreateBuyerServlet / CreateSellerServlet). */
const PLACEHOLDER_PHONE_EMAIL_SUFFIXES = ["@buyer.phone.ihute.rw", "@phone.ishyiga.local"] as const

/** Client-only display placeholders ({@link auth-login-client} `…@phone.local`) and register flow — not in Java DB but users paste them into reset. */
const CLIENT_DISPLAY_PHONE_EMAIL_SUFFIXES = ["@phone.local", "@phone-register.ihute.local"] as const

const ALL_RESET_EMAIL_SUFFIXES = [
  ...PLACEHOLDER_PHONE_EMAIL_SUFFIXES,
  ...CLIENT_DISPLAY_PHONE_EMAIL_SUFFIXES,
] as const

function isSyntheticPlaceholderEmailAddress(full: string): boolean {
  const lower = full.trim().toLowerCase()
  return ALL_RESET_EMAIL_SUFFIXES.some((suf) => lower.endsWith(suf.toLowerCase()))
}

/**
 * If the user pasted a phone-shaped login email into the phone field, use the local part so
 * reset variants match DB `tel` / synthetic emails.
 */
export function coerceTelRawForPasswordReset(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (!t.includes("@")) return t
  const local = t.slice(0, t.indexOf("@")).trim()
  if (digitsOnly(local).length >= 9) return local
  return t
}

/**
 * Values to try as Java login `email` (phone digits or synthetic emails) so buyer + seller
 * rows match (07…, 250…, 9-digit, {@code …@buyer.phone.ihute.rw}, {@code …@phone.ishyiga.local}).
 */
export function rwJavaLoginIdentifiers(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.includes("@")) {
    if (!isSyntheticPlaceholderEmailAddress(t)) {
      return [t]
    }
    const local = t.slice(0, Math.max(0, t.indexOf("@")))
    const fromPhone = rwJavaLoginIdentifiers(local)
    const out: string[] = []
    const seen = new Set<string>()
    const add = (x: string) => {
      const s = x.trim()
      if (!s || seen.has(s)) return
      seen.add(s)
      out.push(s)
    }
    add(t)
    for (const x of fromPhone) add(x)
    return out
  }

  const d = digitsOnly(t)
  if (!d) return [t]

  const out: string[] = []
  const seen = new Set<string>()
  const add = (x: string) => {
    const s = x.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }

  const canon = normalizePhoneDigitsForAuth(t) || t
  add(canon)
  add(d)

  if (canon.length === 12 && canon.startsWith("250") && canon[3] === "7") {
    add("0" + canon.slice(3))
    add(canon.slice(3))
  }

  for (const suf of PLACEHOLDER_PHONE_EMAIL_SUFFIXES) {
    add(canon + suf)
    if (canon.length === 12 && canon.startsWith("250")) {
      add("0" + canon.slice(3) + suf)
      add(canon.slice(3) + suf)
    }
  }

  return out
}

/** Values for Java `tel` on reset: synthetic login emails first, then digits (seller rows often use `@phone.ishyiga.local`). */
export function rwJavaResetTelVariants(raw: string): string[] {
  const coerced = coerceTelRawForPasswordReset(raw)
  const emails = rwSyntheticPlaceholderEmailsFromRaw(coerced)
  const digits = rwJavaLoginIdentifiers(coerced).filter((x) => !x.includes("@"))
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of [...emails, ...digits]) {
    if (x && !seen.has(x)) {
      seen.add(x)
      out.push(x)
    }
  }
  if (out.length === 0 && coerced) {
    out.push(coerced)
  }
  return out
}

/** Synthetic emails for DB lookup (seller @phone.ishyiga.local, buyer @buyer.phone.ihute.rw). */
export function rwSyntheticPlaceholderEmailsFromRaw(telRaw: string): string[] {
  const d = digitsOnly(telRaw)
  const canon = normalizePhoneDigitsForAuth(telRaw) || d
  const out: string[] = []
  const seen = new Set<string>()
  const add = (e: string) => {
    const s = e.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }
  for (const suf of ALL_RESET_EMAIL_SUFFIXES) {
    if (canon) add(canon + suf)
    if (d && d !== canon) add(d + suf)
    if (canon.length === 12 && canon.startsWith("250")) add("0" + canon.slice(3) + suf)
  }
  return out
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
