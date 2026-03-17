/**
 * Central image URL resolution for product/supplier images.
 * Backend and Redis can return image in: image_url, item_image_url, IMAGE_URL, image.
 * Use this everywhere we display product images so loading is consistent.
 */

export type ProductImageSource = {
  image?: string | null
  image_url?: string | null
  item_image_url?: string | null
  IMAGE_URL?: string | null
  [key: string]: unknown
}

const IMAGE_KEYS = ["image_url", "item_image_url", "IMAGE_URL", "image"] as const

/** URL to show when no product image is available (KAOS "no image" graphic). Use this instead of a grey placeholder. */
export const NO_IMAGE_URL = "https://ishyiga.rw/images_kaos_beta/no_image_found.jpg"

/**
 * Get the first non-empty image URL from a product-like object.
 * Tries all known backend field names and normalizes the result.
 */
export function getProductImageUrl(
  source: ProductImageSource | null | undefined,
  options?: { placeholder?: string }
): string | null {
  if (!source || typeof source !== "object") return options?.placeholder ?? null
  for (const key of IMAGE_KEYS) {
    const raw = source[key]
    if (raw == null) continue
    const s = typeof raw === "string" ? raw.trim() : String(raw).trim()
    if (s === "") continue
    return normalizeImageUrl(s)
  }
  return options?.placeholder ?? null
}

/**
 * Normalize URL: trim, and fix protocol-less URLs (//...) to https:
 * so they load reliably in img tags and Next/Image.
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const s = (typeof url === "string" ? url : String(url)).trim()
  if (s === "") return null
  if (s.startsWith("//")) return `https:${s}`
  return s
}

/**
 * Returns true if the value looks like a usable image URL (http, https, or /).
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false
  const s = url.trim()
  return s.length > 0 && (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/"))
}

/**
 * Resolve image URL for display: same as getProductImageUrl but returns
 * placeholder when no valid URL (so callers always get a string).
 */
export function getProductImageSrc(
  source: ProductImageSource | null | undefined,
  placeholder: string = "/placeholder.svg?height=300&width=300"
): string {
  const KAOS_BASE = "https://ishyiga.rw/images_kaos_beta/"
  let kaosPrimary: string | null = null
  let kaosSecondary: string | null = null

  if (source && typeof source === "object") {
    const rawFamille = (source as any).famille ?? (source as any).FAMILLE
    const rawNiki =
      (source as any).item_key_words ??
      (source as any).itemCode ??
      (source as any).item_code ??
      (source as any).ITEM_CODE

    const famille = typeof rawFamille === "string" ? rawFamille.trim() : String(rawFamille ?? "").trim()
    const nikiCode = typeof rawNiki === "string" ? rawNiki.trim() : String(rawNiki ?? "").trim()

    if (nikiCode) {
      // Secondary: flat path without famille
      kaosSecondary = `${KAOS_BASE}${nikiCode}.jpg`
      // Primary: famille-based folder when available
      if (famille) {
        const famillePath = famille.replace(/\s+/g, "_")
        kaosPrimary = `${KAOS_BASE}${famillePath}/${nikiCode}.jpg`
      }

      try {
        const debugId =
          (source as any).item_code ??
          (source as any).ITEM_CODE ??
          (source as any).item_key_words ??
          (source as any).id ??
          ""
        // Lightweight console for debugging which KAOS URL we are using
        console.debug("[ImageSrc] KAOS candidate", {
          id: debugId,
          famille,
          nikiCode,
          kaosPrimary,
          kaosSecondary,
        })
      } catch {
        // avoid breaking rendering if console fails
      }
    }
  }

  // Prefer famille-based path, then flat NIKI code path
  if (kaosPrimary) {
    return kaosPrimary
  }
  if (kaosSecondary) {
    return kaosSecondary
  }

  const url = getProductImageUrl(source)
  if (url && isValidImageUrl(url)) {
    try {
      console.debug("[ImageSrc] backend URL fallback", { url })
    } catch {
      // ignore
    }
    return normalizeImageUrl(url) ?? NO_IMAGE_URL
  }

  try {
    console.debug("[ImageSrc] final fallback no_image_found", { placeholder, noImageUrl: NO_IMAGE_URL })
  } catch {
    // ignore
  }

  return NO_IMAGE_URL
}
