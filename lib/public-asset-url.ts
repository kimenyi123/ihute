/** Resolve shop/product asset URLs for <img src> (handles absolute API URLs from beta). */
export function resolvePublicAssetUrl(url: string): string {
  const u = (url || "").trim()
  if (!u) return u
  if (u.startsWith("http://") || u.startsWith("https://")) return u
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
  if (base && u.startsWith("/") && !u.startsWith(`${base}/`)) {
    return `${base}${u}`
  }
  return u
}
