/**
 * MTN Rwanda MoMo USSD:
 * - Merchant / MoMo Pay code: *182*8*1*{code}*{amount}#
 * - Send to phone:          *182*1*1*{07XXXXXXXX}*{amount}#
 *
 * Set NEXT_PUBLIC_MOMO_USSD_PREFIX (e.g. *182*8*1*) to force one template for all targets (legacy).
 */

const LEGACY_PREFIX =
  typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_MOMO_USSD_PREFIX?.trim() ?? "" : ""

const MERCHANT_PREFIX = "*182*8*1*"
const PHONE_PREFIX = "*182*1*1*"

/** Strip leading labels so we never dial "MTN MoMo: …" as part of the USSD segment */
export function stripMomoLabel(raw: string): string {
  return (raw || "")
    .replace(/^\s*(MTN\s*MoMo|MoMo|Airtel\s*Money|Airtel)\s*:\s*/i, "")
    .trim()
}

/**
 * Shop-with-me / Java often expose MoMo Pay merchant code in the seller `momo` field (e.g. "999998").
 * Map that onto cart lines: short digit codes → `momoCode`; Rwanda MSISDN shapes → `momo`.
 */
export function cartMomoFieldsFromShopWithMeSellerMomo(raw: string | null | undefined): {
  momo?: string
  momoCode?: string
} {
  const v = String(raw ?? "").trim()
  if (!v) return {}
  const digits = v.replace(/\D/g, "")
  const compactNoSpace = v.replace(/\s/g, "")
  const isOnlyDigits = compactNoSpace === digits && /^\d+$/.test(digits)

  if (isOnlyDigits) {
    if (digits.length === 10 && digits.startsWith("07")) return { momo: v }
    if (digits.length === 12 && digits.startsWith("250")) return { momo: v }
    if (digits.length >= 4 && digits.length <= 8) return { momoCode: digits }
  }
  return { momo: v }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

/** Normalize to local 07XXXXXXXX when possible */
function rwPhoneSegmentFromDigits(d: string): string | null {
  if (d.length === 10 && d.startsWith("07")) return d
  if (d.length === 12 && d.startsWith("250") && d[3] === "7") return `0${d.slice(3)}`
  if (d.length === 9 && d.startsWith("7")) return `0${d}`
  return null
}

export type ResolvedMtnMomoUssd = {
  ussd: string
  kind: "merchant" | "phone"
  /** Value embedded in USSD (code or MSISDN) */
  segment: string
  /** Shown on "Copy" / receipts */
  copyLabel: string
}

function buildWithLegacyPrefix(segment: string, amount: number): string {
  const amt = Math.round(amount)
  const p = LEGACY_PREFIX.endsWith("*") ? LEGACY_PREFIX : `${LEGACY_PREFIX}*`
  return `${p}${segment}*${amt}#`
}

/**
 * Account line for order summary / payment screen:
 * - Prefer explicit merchant MoMo code from API when present
 * - Otherwise show phone (or remainder) without repeating "MTN MoMo:"
 */
export function formatSellerMomoAccountLine(
  sellerMomoRaw: string,
  explicitMerchantCode?: string | null
): string {
  const code = (explicitMerchantCode ?? "").trim()
  if (code) return `MoMo code: ${code}`
  const rest = stripMomoLabel(sellerMomoRaw)
  if (rest) return rest
  const t = (sellerMomoRaw || "").trim()
  return t || "—"
}

/**
 * Resolve USSD from seller-facing `momo` string plus optional merchant code from profile.
 */
export function resolveMtnMoMoUssd(
  sellerMomoRaw: string,
  amount: number,
  explicitMerchantCode?: string | null
): ResolvedMtnMomoUssd | null {
  const amt = Math.round(amount)
  const merchantExplicit = (explicitMerchantCode ?? "").trim()
  const merchantDigits = digitsOnly(merchantExplicit)

  const stripped = stripMomoLabel(sellerMomoRaw)
  const strippedDigits = digitsOnly(stripped)

  if (LEGACY_PREFIX) {
    const segment =
      merchantDigits ||
      merchantExplicit.replace(/\s+/g, "") ||
      strippedDigits ||
      stripped.replace(/[^\w\d]/g, "")
    if (!segment) return null
    const usedMerchant = Boolean(merchantDigits || merchantExplicit)
    return {
      ussd: buildWithLegacyPrefix(segment, amt),
      kind: usedMerchant ? "merchant" : "phone",
      segment,
      copyLabel: merchantExplicit || stripped || sellerMomoRaw.trim(),
    }
  }

  if (merchantDigits || (merchantExplicit && !strippedDigits)) {
    const seg = merchantDigits || merchantExplicit.replace(/\s+/g, "")
    if (!seg) return null
    return {
      ussd: `${MERCHANT_PREFIX}${seg}*${amt}#`,
      kind: "merchant",
      segment: seg,
      copyLabel: merchantExplicit || seg,
    }
  }

  // Masked display numbers cannot be dialed reliably (e.g. 078***000 → wrong digits)
  if (stripped.includes("*") && /^07[\d*]+$/.test(stripped.replace(/\s/g, ""))) {
    return null
  }

  const phoneSeg = rwPhoneSegmentFromDigits(strippedDigits)
  if (phoneSeg) {
    return {
      ussd: `${PHONE_PREFIX}${phoneSeg}*${amt}#`,
      kind: "phone",
      segment: phoneSeg,
      copyLabel: phoneSeg,
    }
  }

  // Short numeric → treat as merchant MoMo Pay code
  if (strippedDigits.length >= 4 && strippedDigits.length <= 8) {
    return {
      ussd: `${MERCHANT_PREFIX}${strippedDigits}*${amt}#`,
      kind: "merchant",
      segment: strippedDigits,
      copyLabel: strippedDigits,
    }
  }

  if (!strippedDigits) return null

  return {
    ussd: `${MERCHANT_PREFIX}${strippedDigits}*${amt}#`,
    kind: "merchant",
    segment: strippedDigits,
    copyLabel: strippedDigits,
  }
}

/** @deprecated Prefer resolveMtnMoMoUssd; kept for call sites that only need the string */
export function buildMoMoUssd(momoCode: string, amount: number): string {
  return resolveMtnMoMoUssd(momoCode, amount, null)?.ussd ?? ""
}
