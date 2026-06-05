import { getBackendBase } from "@/lib/backend-config"

/** Turn account_seller.photo (or legacy paths) into a browser-loadable URL. */
export function resolveSellerPhotoUrl(photo: string | null | undefined): string {
  const p = (photo || "").trim()
  if (!p) return ""
  if (p.startsWith("http://") || p.startsWith("https://")) return p

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")

  if (p.startsWith("/api/") || p.startsWith("/uploads/")) {
    return site ? `${site}${basePath}${p}` : `${basePath}${p}`
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
