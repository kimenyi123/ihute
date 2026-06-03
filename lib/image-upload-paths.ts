import { existsSync } from "fs"
import path from "path"

/**
 * Absolute path to the Next.js `public` folder.
 *
 * On beta/production set in `.env` or PM2:
 *   IHUTE_PUBLIC_DIR=/var/www/ihute-frontend_beta/public
 *
 * When the app runs from `.next/standalone`, we also try the project-root `public/`.
 */
export function resolvePublicDir(): string {
  const explicit = (process.env.IHUTE_PUBLIC_DIR || "").trim()
  if (explicit) return path.resolve(explicit)

  const cwd = process.cwd()
  const fromCwd = path.join(cwd, "public")
  if (existsSync(fromCwd)) return fromCwd

  const standaloneSibling = path.join(cwd, "..", "..", "public")
  if (cwd.includes(`${path.sep}.next${path.sep}standalone`) && existsSync(standaloneSibling)) {
    return path.resolve(standaloneSibling)
  }

  return fromCwd
}

export function getShopUploadsDir(): string {
  const explicit = (process.env.SHOP_UPLOADS_DIR || "").trim()
  if (explicit) return path.resolve(explicit)
  return path.join(resolvePublicDir(), "uploads", "shops")
}

export function getProductUploadsDir(): string {
  return path.join(resolvePublicDir(), "uploads", "products")
}

export function getShopOverridesFile(): string {
  return path.join(getShopUploadsDir(), "overrides.json")
}

export function getLegacyShopOverridesFile(): string {
  return path.join(process.cwd(), ".data", "shop-image-overrides.json")
}

export function getProductOverridesFile(): string {
  return path.join(process.cwd(), ".data", "supplier-image-overrides.json")
}

/** Browser-facing URL for a shop image (absolute when NEXT_PUBLIC_SITE_URL is set — reliable on beta). */
export function shopImagePublicUrl(fileName: string): string {
  const rel = `/api/images/shops/${encodeURIComponent(fileName)}`
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
  if (site) {
    return `${site}${base}${rel}`
  }
  return `${base}${rel}`
}

/** Normalize stored override paths to a loadable shop logo URL. */
export function normalizeShopImagePublicUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith("http://") || u.startsWith("https://")) return u

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "")
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
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

  if (site && rel.startsWith("/")) {
    return `${site}${base}${rel}`
  }
  if (base && rel.startsWith("/") && !rel.startsWith(base)) {
    return `${base}${rel}`
  }
  return rel
}
