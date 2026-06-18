import { getBackendBase } from "@/lib/backend-config"

function siteAndBase(): { site: string; basePath: string } {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
  return { site, basePath }
}

/** Turn account_seller.photo (or legacy paths) into a browser-loadable URL. */
export function resolveSellerPhotoUrl(photo: string | null | undefined): string {
  const p = (photo || "").trim()
  if (!p) return ""
  if (p.startsWith("http://") || p.startsWith("https://")) return p

  const { site, basePath } = siteAndBase()

  if (p.startsWith("/api/") || p.startsWith("/uploads/")) {
    return site ? `${site}${basePath}${p}` : `${basePath}${p}`
  }

  // Tomcat /img/shops/… — proxy via Next so beta (/beta base path) and Trading_beta backend work in browser.
  if (p.startsWith("/img/shops/") || p.startsWith("img/shops/")) {
    const normalized = p.startsWith("/") ? p : `/${p}`
    const proxyRel = `${basePath}/api/images/seller-photo?path=${encodeURIComponent(normalized)}`
    return site ? `${site}${proxyRel}` : proxyRel
  }

  const tradingBase = getBackendBase().replace(/\/+$/, "")
  if (p.startsWith("/img/")) {
    return `${tradingBase}${p}`
  }
  if (p.startsWith("img/")) {
    return `${tradingBase}/${p}`
  }

  return p
}
