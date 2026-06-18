/**
 * Dev-only: show UrubutoPay on checkout before Urubuto assigns a real merchant code.
 * Set in .env.local (never enable in production):
 *   NEXT_PUBLIC_URUBUTO_CHECKOUT_PREVIEW=1
 *   NEXT_PUBLIC_URUBUTO_PREVIEW_SELLERS=ALGGG0942009
 * Leave PREVIEW_SELLERS empty to preview for every seller in cart.
 */

export function isUrubutoCheckoutPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  const v = process.env.NEXT_PUBLIC_URUBUTO_CHECKOUT_PREVIEW?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function urubutoCheckoutPreviewSellerAllowlist(): string[] | null {
  const raw = process.env.NEXT_PUBLIC_URUBUTO_PREVIEW_SELLERS?.trim()
  if (!raw) return null
  const list = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return list.length ? list : null
}

/** True when checkout should show UrubutoPay for this seller (preview only). */
export function isUrubutoCheckoutPreviewForSeller(sellerAccount: string): boolean {
  if (!isUrubutoCheckoutPreviewEnabled()) return false
  const acc = sellerAccount.trim().toUpperCase()
  if (!acc) return false
  const allow = urubutoCheckoutPreviewSellerAllowlist()
  if (!allow) return true
  return allow.includes(acc)
}
