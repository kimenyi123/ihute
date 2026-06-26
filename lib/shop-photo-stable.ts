/** Stable shop logo path per account — same value in DB after every upload. */

export function normalizeShopAccountKey(account: string): string {
  return account.replace(/\s+/g, " ").trim().toUpperCase()
}

function safeAccountSegment(account: string): string {
  const s = normalizeShopAccountKey(account).replace(/[^a-zA-Z0-9._-]+/g, "_")
  return s.slice(0, 120) || "SHOP"
}

export function stableShopPhotoFileName(account: string, ext: string): string {
  const e = (ext || "png").replace(/^\./, "").toLowerCase()
  const normalized =
    e === "jpeg" ? "jpg" : ["png", "jpg", "webp", "gif"].includes(e) ? e : "png"
  return `${safeAccountSegment(account)}.${normalized}`
}

/** Canonical value for account_seller.photo (Tomcat web path). */
export function stableShopPhotoWebPath(account: string, ext: string): string {
  return `/img/shops/${stableShopPhotoFileName(account, ext)}`
}

/** Legacy rows: /img/shops/ALGGG0942009_1781777474149.png → ALGGG0942009 */
export function parseShopPhotoAccountFromWebPath(webPath: string): string | null {
  const m = String(webPath || "").match(/\/img\/shops\/([A-Za-z0-9._-]+?)(?:_\d+)?\.[a-z0-9]+$/i)
  return m ? m[1].toUpperCase() : null
}
