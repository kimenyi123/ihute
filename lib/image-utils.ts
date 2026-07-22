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

/** Official NIKI product photos on ishyiga.rw (prefer before KAOS famille paths). */
export const NIKI_IMAGES_BASE = "https://ishyiga.rw/NIKI/images/"

function looksLikeNikiCode(value: string): boolean {
  const v = value.trim()
  if (v.length < 4 || v.length > 32) return false
  if (/\s/.test(v)) return false
  return /^[A-Za-z0-9_-]+$/.test(v)
}

/** Prefer real niki_code fields for CDN photos (not free-text item_key_words). */
export function getNikiCodeForCdnImage(source: unknown): string {
  if (!source || typeof source !== "object") return ""
  const o = source as Record<string, unknown>
  const pick = (keys: string[]): string => {
    for (const k of keys) {
      const raw = o[k]
      if (raw == null) continue
      const v = typeof raw === "string" ? raw.trim() : String(raw).trim()
      if (v !== "" && looksLikeNikiCode(v)) return v
    }
    return ""
  }
  return (
    pick(["niki_code", "NIKI_CODE", "nikiCode", "nikicode"]) ||
    pick(["ITEM_CODE", "item_code", "itemCode"]) ||
    pick(["item_key_words"])
  )
}

/**
 * NIKI code for images / KAOS paths: prefer explicit niki_code, then catalog codes.
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
    const n = normalizeImageUrl(s)
    if (!n || !isValidImageUrl(n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/**
 * Ordered URLs to try for a product image:
 * 1) https://ishyiga.rw/NIKI/images/{niki_code}.jpg (+ jpeg/png)
 * 2) KAOS famille / flat paths
 * 3) backend image fields
 * 4) no_image
 */
export function getProductImageCandidates(source: ProductImageSource | null | undefined): string[] {
  const KAOS_BASE = "https://ishyiga.rw/images_kaos_beta/"
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string | null | undefined) => {
    const n = normalizeImageUrl(u ?? null)
    if (!n || !isValidImageUrl(n)) return
    if (seen.has(n)) return
    seen.add(n)
    out.push(n)
  }

  if (source && typeof source === "object") {
    const rawFamille = (source as any).famille ?? (source as any).FAMILLE
    const nikiCdnCode = getNikiCodeForCdnImage(source)
    const nikiCode = getNikiCodeFromSource(source)
    const famille = typeof rawFamille === "string" ? rawFamille.trim() : String(rawFamille ?? "").trim()
    const nikiPath = nikiCode ? sanitizeKaosSegment(nikiCode) : ""

    if (nikiCdnCode) {
      const safe = encodeURIComponent(nikiCdnCode)
      add(`${NIKI_IMAGES_BASE}${safe}.jpg`)
      add(`${NIKI_IMAGES_BASE}${safe}.jpeg`)
      add(`${NIKI_IMAGES_BASE}${safe}.png`)
    }

    if (nikiPath) {
      if (famille) {
        add(`${KAOS_BASE}${sanitizeKaosSegment(famille)}/${nikiPath}.jpg`)
      }
      add(`${KAOS_BASE}${nikiPath}.jpg`)
      try {
        console.debug("[ImageSrc] KAOS candidates", {
          id: getNikiCodeFromSource(source) || String((source as any).id ?? ""),
          famille,
          nikiCode,
          nikiPath,
        })
      } catch {
        /* ignore */
      }
    }
  }

  for (const u of collectBackendImageUrls(source)) {
    add(u)
  }

  add(NO_IMAGE_URL)

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
