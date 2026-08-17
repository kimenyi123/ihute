/**
 * MoMo USSD string for payment: *182*8*1*momocode*amount#
 * Override with NEXT_PUBLIC_MOMO_USSD_PREFIX if your operator uses a different shortcode.
 */
const PREFIX =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MOMO_USSD_PREFIX) || "*182*8*1*"

export function buildMoMoUssd(momoCode: string, amount: number): string {
  const code = (momoCode || "").trim()
  if (!code) return ""
  return `${PREFIX}${code}*${Math.round(amount)}#`
}
