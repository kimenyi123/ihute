"use client"

import { useEffect, useState } from "react"
import {
  getProductImageCandidates,
  isValidImageUrl,
  NO_IMAGE_URL,
  type ProductImageSource,
} from "@/lib/image-utils"

type ProductImageFallbackProps = {
  source: ProductImageSource | null | undefined
  alt?: string
  className?: string
}

/**
 * Tries KAOS famille path → flat NIKI → backend image fields → no_image graphic,
 * advancing on load error (same chain as cart / quick view).
 */
export function ProductImageFallback({ source, alt = "", className }: ProductImageFallbackProps) {
  const candidates = (() => {
    try {
      return getProductImageCandidates(source)
    } catch {
      return [NO_IMAGE_URL]
    }
  })()
  const candidatesSignature = candidates.join("\x1e")
  const [candidateIdx, setCandidateIdx] = useState(0)

  useEffect(() => {
    setCandidateIdx(0)
  }, [candidatesSignature])

  const raw =
    candidates[Math.min(candidateIdx, Math.max(0, candidates.length - 1))] ?? NO_IMAGE_URL
  const src = isValidImageUrl(raw) ? raw : NO_IMAGE_URL

  return (
    <img
      key={`${src}-${candidateIdx}`}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (candidateIdx + 1 < candidates.length) {
          setCandidateIdx((i) => i + 1)
        }
      }}
    />
  )
}
