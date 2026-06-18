/** Client-safe URL helpers for uploaded shop/product images (no Node fs). */

function siteBase(): { site: string; base: string } {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
  return { site, base }
}

function withSiteBase(rel: string): string {
  const { site, base } = siteBase()
  if (site && rel.startsWith("/")) {
    return `${site}${base}${rel}`
  }
  if (base && rel.startsWith("/") && !rel.startsWith(base)) {
    return `${base}${rel}`
  }
  return rel
}

/** Resolve shop/product asset URLs for <img src> (handles absolute API URLs from beta). */
export function resolvePublicAssetUrl(url: string): string {
  const u = (url || "").trim()
  if (!u) return u
  if (u.startsWith("http://") || u.startsWith("https://")) return u
  const { base } = siteBase()
  if (base && u.startsWith("/") && !u.startsWith(`${base}/`)) {
    return `${base}${u}`
  }
  return u
}

/** Browser-facing URL for a shop image (absolute when NEXT_PUBLIC_SITE_URL is set). */
export function shopImagePublicUrl(fileName: string): string {
  const rel = `/api/images/shops/${encodeURIComponent(fileName)}`
  return withSiteBase(rel)
}

/** Browser-facing URL for a product image (absolute when NEXT_PUBLIC_SITE_URL is set). */
export function productImagePublicUrl(fileName: string): string {
  const rel = `/api/images/products/${encodeURIComponent(fileName)}`
  return withSiteBase(rel)
}

/** Normalize legacy `/uploads/products/...` paths to API serve URLs. */
export function normalizeProductImagePublicUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith("http://") || u.startsWith("https://")) return u

  const { site, base } = siteBase()
  const prefix = `${base}/uploads/products/`
  const barePrefix = "/uploads/products/"

  let rel = u
  if (u.startsWith(prefix)) {
    rel = `/api/images/products/${encodeURIComponent(u.slice(prefix.length).split("?")[0])}`
  } else if (u.startsWith(barePrefix)) {
    rel = `/api/images/products/${encodeURIComponent(u.slice(barePrefix.length).split("?")[0])}`
  } else if (u.startsWith("/api/images/products/") && site) {
    return `${site}${base}${u}`
  }

  return withSiteBase(rel)
}

/** Normalize stored override paths to a loadable shop logo URL. */
export function normalizeShopImagePublicUrl(url: string): string {
  const u = url.trim()
  if (!u) return u

  const { site, base } = siteBase()

  // Rebuild any absolute /api/images/shops/ URL with current site (fixes legacy ihute.rw/Trading_beta/beta/… entries).
  const shopsApi = u.match(/\/api\/images\/shops\/([^?#]+)/i)
  if (shopsApi) {
    const rel = `/api/images/shops/${shopsApi[1]}`
    return site ? `${site}${base}${rel}` : withSiteBase(rel)
  }

  if (u.startsWith("http://") || u.startsWith("https://")) return u

  const prefix = `${base}/uploads/shops/`
  const barePrefix = "/uploads/shops/"

  let rel = u
  if (u.startsWith(prefix)) {
    rel = `/api/images/shops/${encodeURIComponent(u.slice(prefix.length).split("?")[0])}`
  } else if (u.startsWith(barePrefix)) {
    rel = `/api/images/shops/${encodeURIComponent(u.slice(barePrefix.length).split("?")[0])}`
  } else if (u.startsWith("/api/images/shops/") && site) {
    return `${site}${base}${u}`
  }

  return withSiteBase(rel)
}
