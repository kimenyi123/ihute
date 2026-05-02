"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getProductImageCandidates,
  isValidImageUrl,
  normalizeImageUrl,
  NO_IMAGE_URL,
  type ProductImageSource,
} from "@/lib/image-utils"

type Props = {
  product: ProductImageSource & Record<string, unknown>
  alt: string
}

function firstStoredImageHref(product: Record<string, unknown>): string | null {
  for (const key of ["imageUrl", "IMAGE_URL", "image_url", "item_image_url", "image"] as const) {
    const raw = product[key]
    if (raw == null) continue
    const s = typeof raw === "string" ? raw.trim() : String(raw).trim()
    const n = normalizeImageUrl(s)
    if (n && isValidImageUrl(n)) return n
  }
  return null
}

/**
 * Supplier row: thumbnail (KAOS **.jpg → .jpeg → .png** + backend fields, `onError` advances) plus **View Image**.
 */
export function SupplierProductTableImage({ product, alt }: Props) {
  const imageCandidates = useMemo(
    () => getProductImageCandidates(product),
    [
      product.item_key_words,
      product.ITEM_CODE,
      (product as { itemCode?: string }).itemCode,
      (product as { famille?: string }).famille,
      (product as { FAMILLE?: string }).FAMILLE,
      product.image_url,
      product.item_image_url,
      product.IMAGE_URL,
      product.image,
    ]
  )

  const candidatesSignature = imageCandidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setCandidateIdx(0)
    setImgError(false)
  }, [candidatesSignature])

  const resolvedUrl =
    imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] ?? NO_IMAGE_URL
  const hasValidUrl = isValidImageUrl(resolvedUrl)
  const src = !imgError && hasValidUrl ? resolvedUrl : NO_IMAGE_URL
  const storedHref = firstStoredImageHref(product as Record<string, unknown>)
  const viewHref =
    src !== NO_IMAGE_URL && isValidImageUrl(src) ? src : storedHref

  return (
    <div className="flex flex-row items-center gap-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <img
          key={src}
          src={src}
          alt={alt || "Product"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (candidateIdx + 1 < imageCandidates.length) {
              setCandidateIdx((i) => i + 1)
              setImgError(false)
            } else {
              setImgError(true)
            }
          }}
        />
      </div>
      {viewHref ? (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          title={alt}
          className="shrink-0 text-blue-600 hover:text-blue-800 underline text-sm whitespace-nowrap"
        >
          View Image
        </a>
      ) : (
        <span className="shrink-0 text-slate-400 text-sm whitespace-nowrap">—</span>
      )}
    </div>
  )
}
