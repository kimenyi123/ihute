import { normalizeProductImagePublicUrl } from "@/lib/public-asset-url"

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
  imageUrl?: string | null
  photo?: string | null
  PHOTO?: string | null
  item_photo?: string | null
  ITEM_PHOTO?: string | null
  picture?: string | null
  PICTURE?: string | null
  product_image?: string | null
  productImage?: string | null
  [key: string]: unknown
}

const IMAGE_KEYS = [
  "image_url",
  "item_image_url",
  "IMAGE_URL",
  "image",
  "imageUrl",
  "ImageUrl",
  "photo",
  "PHOTO",
  "item_photo",
  "ITEM_PHOTO",
  "picture",
  "PICTURE",
  "picture_url",
  "product_image",
  "productImage",
  "PRODUCT_IMAGE",
  "IMAGE_URL_1",
  "IMAGE_URL_2",
  "IMAGE_URL_3",
] as const

/** URL to show when no product image is available (KAOS "no image" graphic). Use this instead of a grey placeholder. */
export const NO_IMAGE_URL = "https://ishyiga.rw/images_kaos_beta/no_image_found.jpg"

/** KAOS CDN may store product images as jpg, jpeg, or png — try in this order before no_image. */
export const KAOS_PRODUCT_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const

/** Push each extension variant for a KAOS base path without trailing extension (e.g. …/famille/NIKI). */
export function addKaosProductImageExtensionVariants(
  baseUrlWithoutExtension: string,
  add: (url: string) => void
): void {
  for (const ext of KAOS_PRODUCT_IMAGE_EXTENSIONS) {
    add(`${baseUrlWithoutExtension}${ext}`)
  }
}

/** True if URL is not a "missing image" or generic placeholder (cart should retry resolution). */
export function isConcreteProductImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false
  const s = url.trim().toLowerCase()
  if (s === "") return false
  if (!isValidImageUrl(url)) return false
  if (s.includes("no_image_found")) return false
  if (s.includes("placeholder.svg")) return false
  if (s.includes("placeholder?")) return false
  return true
}

/** File / folder segment for KAOS paths (spaces → underscores, like famille). */
function sanitizeKaosSegment(segment: string): string {
  return segment.replace(/\s+/g, "_").replace(/\/+/g, "_")
}

/**
 * Extract clean NIKI code token from raw value, id, or multi-word item_key_words
 * (e.g. "DRIZEST00223 ZESTA ACETIC ACID..." -> "DRIZEST00223").
 */
export function extractNikiCode(raw: unknown): string {
  if (raw == null) return ""
  const s = (typeof raw === "string" ? raw : String(raw)).trim()
  if (!s) return ""

  // If it's already a single clean alphanumeric token
  if (/^[A-Za-z0-9_.-]+$/.test(s) && s.length >= 1 && s.length <= 64) {
    return s
  }

  // If it starts with a NIKI code token like "CONWINN00954 WINNAZ PAPRIKA ..."
  const firstToken = s.split(/\s+/)[0]?.trim() || ""
  if (firstToken && /^[A-Za-z0-9_.-]+$/.test(firstToken) && firstToken.length >= 3 && firstToken.length <= 64) {
    return firstToken
  }

  // Match standard NIKI code patterns within string (e.g. DRIZEST00223, MECHIC00001)
  const match = s.match(/\b([A-Za-z]{2,8}\d{2,10}[A-Za-z0-9_-]*)\b/)
  if (match && match[1]) {
    return match[1]
  }

  return ""
}

/** Official NIKI product photos on ishyiga.rw. */
export const NIKI_IMAGES_BASE = "https://ishyiga.rw/NIKI/images/"

/**
 * NIKI code for CDN photos: extracts clean token from niki_code, item_code, id, or keywords.
 */
export function getNikiCodeForCdnImage(source: unknown): string {
  if (!source || typeof source !== "object") return ""
  const o = source as Record<string, unknown>
  const pick = (keys: string[]): string => {
    for (const k of keys) {
      const raw = o[k]
      if (raw == null) continue
      const code = extractNikiCode(raw)
      if (code) return code
    }
    return ""
  }
  return (
    pick(["niki_code", "NIKI_CODE", "nikiCode", "nikicode", "CODE_ISHYIGA", "code_ishyiga"]) ||
    pick(["ITEM_CODE", "item_code", "itemCode", "product_code", "productCode", "code"]) ||
    pick(["id", "item_key_words"])
  )
}

function looksLikeNikiCode(value: string): boolean {
  const v = value.trim()
  if (v.length < 1 || v.length > 64) return false
  if (/\s/.test(v)) return false
  return /^[A-Za-z0-9_.-]+$/.test(v)
}

/** https://ishyiga.rw/NIKI/images/{niki_code}.jpg (+ jpeg/png fallbacks). */
export function addNikiCdnImageCandidates(nikiCode: string, add: (url: string) => void): void {
  const code = extractNikiCode(nikiCode)
  if (!code) return

  // Exact code first: {niki_code}.jpg
  const safe = encodeURIComponent(code)
  for (const ext of KAOS_PRODUCT_IMAGE_EXTENSIONS) {
    add(`${NIKI_IMAGES_BASE}${safe}${ext}`)
  }

  // Uppercase variant if different
  const upper = code.toUpperCase()
  if (upper !== code) {
    const safeUpper = encodeURIComponent(upper)
    for (const ext of KAOS_PRODUCT_IMAGE_EXTENSIONS) {
      add(`${NIKI_IMAGES_BASE}${safeUpper}${ext}`)
    }
  }

  // Lowercase variant if different
  const lower = code.toLowerCase()
  if (lower !== code && lower !== upper) {
    const safeLower = encodeURIComponent(lower)
    for (const ext of KAOS_PRODUCT_IMAGE_EXTENSIONS) {
      add(`${NIKI_IMAGES_BASE}${safeLower}${ext}`)
    }
  }
}

/**
 * NIKI code for images / KAOS paths: prefer explicit niki_code, then catalog codes.
 * `item_key_words` is last — on shop-with-me it is often keywords, not the NIKI id.
 */
export function getNikiCodeFromSource(source: unknown): string {
  if (!source || typeof source !== "object") return ""
  const o = source as Record<string, unknown>
  const pick = (keys: string[]): string => {
    for (const k of keys) {
      const raw = o[k]
      if (raw == null) continue
      const v = typeof raw === "string" ? raw.trim() : String(raw).trim()
      if (v !== "") return v
    }
    return ""
  }
  const fromCdn = getNikiCodeForCdnImage(source)
  if (fromCdn) return fromCdn
  return pick([
    "niki_code",
    "NIKI_CODE",
    "nikiCode",
    "nikicode",
    "ITEM_CODE",
    "item_code",
    "itemCode",
    "item_key_words",
  ])
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

/** Every distinct backend image field (not only the first), for multi-step img onError fallbacks. */
function collectBackendImageUrls(source: ProductImageSource | null | undefined): string[] {
  const out: string[] = []
  if (!source || typeof source !== "object") return out
  const seen = new Set<string>()
  for (const key of IMAGE_KEYS) {
    const raw = source[key]
    if (raw == null) continue
    const s = typeof raw === "string" ? raw.trim() : String(raw).trim()
    if (s === "") continue
    let n = normalizeImageUrl(s)
    if (!n || !isValidImageUrl(n)) continue
    if (n.includes("/uploads/products/") || n.includes("/api/images/products/")) {
      n = normalizeProductImagePublicUrl(n)
    }
    if (!n || !isValidImageUrl(n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  
  // Debug: Log what backend image fields contain
  console.log("[ImageUtils] Backend image fields:", {
    image_url: source.image_url,
    item_image_url: source.item_image_url,
    IMAGE_URL: (source as any).IMAGE_URL,
    image: source.image,
    foundValidUrls: out
  })
  
  return out
}

/**
 * Ordered URLs to try for a product image:
 * 1) https://ishyiga.rw/NIKI/images/{niki_code}.jpg (+ jpeg/png)
 * 2) backend image fields (image_url, item_image_url, IMAGE_URL, image, photo, etc.)
 * 3) no_image placeholder
 * Use with onError → next index when the CDN returns 404.
 */
export function getProductImageCandidates(source: ProductImageSource | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string | null | undefined) => {
    let n = normalizeImageUrl(u ?? null)
    if (!n || !isValidImageUrl(n)) return
    if (n.includes("/uploads/products/") || n.includes("/api/images/products/")) {
      n = normalizeProductImagePublicUrl(n)
    }
    if (!n || !isValidImageUrl(n)) return
    if (seen.has(n)) return
    seen.add(n)
    out.push(n)
  }

  // Debug: Log the entire source object
  if (typeof window !== "undefined") {
    console.log("[ImageUtils] Full product data for image resolution:", source)
  }

  if (source && typeof source === "object") {
    const nikiCdnCode = getNikiCodeForCdnImage(source)
    const nikiCode = getNikiCodeFromSource(source)

    // 1) Official NIKI photos: https://ishyiga.rw/NIKI/images/{niki_code}.jpg
    if (nikiCdnCode) {
      addNikiCdnImageCandidates(nikiCdnCode, (u) => add(u))
    }
    if (nikiCode && nikiCode !== nikiCdnCode) {
      addNikiCdnImageCandidates(nikiCode, (u) => add(u))
    }

    // 2) Fallback to normal DB column images if NIKI photo is missing/404
    for (const u of collectBackendImageUrls(source)) {
      add(u)
    }
  } else {
    console.warn("[ImageUtils] Invalid source object for image resolution")
  }

  // Ensure any backend image URLs outside source object branch are collected
  for (const u of collectBackendImageUrls(source)) {
    add(u)
  }

  add(NO_IMAGE_URL)

  // Debug: Log final candidates
  if (typeof window !== "undefined") {
    console.log("[ImageUtils] Final image candidates:", out)
  }

  return out.length > 0 ? out : [NO_IMAGE_URL]
}

/**
 * Resolve image URL for display: first candidate from getProductImageCandidates.
 * @param placeholder kept for API compatibility; final fallback is NO_IMAGE_URL when nothing else matches.
 */
export function getProductImageSrc(
  source: ProductImageSource | null | undefined,
  _placeholder: string = "/placeholder.svg?height=300&width=300"
): string {
  const candidates = getProductImageCandidates(source)
  return candidates[0] ?? NO_IMAGE_URL
}

/**
 * Get the first non-empty image URL from a product-like object.
 * Tries backend fields first; if none, same resolution as display (KAOS jpg/jpeg/png + fallbacks).
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
  const resolved = getProductImageSrc(source, options?.placeholder ?? "/placeholder.svg?height=300&width=300")
  if (resolved === NO_IMAGE_URL) return options?.placeholder ?? null
  return resolved
}

/**
 * Cart / checkout rows:
 * 1) Concrete `image` saved at add-to-cart (not no_image / placeholder)
 * 2) Backend fields on the line (`image_url`, `item_image_url`, `IMAGE_URL`) if passed when adding
 * 3) Full resolution via getProductImageSrc (KAOS + backend + no_image)
 */
export function getCartItemImageSrc(
  item: ProductImageSource | null | undefined,
  placeholder: string = "/placeholder.svg?height=64&width=64"
): string {
  if (item && typeof item === "object") {
    const anyItem = item as Record<string, unknown>
    const tryUrl = (raw: unknown): string | null => {
      if (raw == null) return null
      const s = (typeof raw === "string" ? raw : String(raw)).trim()
      if (!isConcreteProductImageUrl(s)) return null
      return normalizeImageUrl(s) ?? s
    }

    const fromStored = tryUrl(anyItem.image)
    if (fromStored) return fromStored

    for (const key of ["image_url", "item_image_url", "IMAGE_URL"] as const) {
      const u = tryUrl(anyItem[key])
      if (u) return u
    }
  }
  return getProductImageSrc(item, placeholder)
}
