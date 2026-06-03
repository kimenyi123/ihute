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

/** Public URL for a shop image file (served via Next API — works on beta when static /uploads is missing). */
export function shopImagePublicUrl(fileName: string): string {
  return `/api/images/shops/${encodeURIComponent(fileName)}`
}
