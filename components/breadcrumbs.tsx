"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import Image from "next/image"
import { useMemo, useState, useEffect } from "react"
import { 
  isValidImageUrl, 
  NO_IMAGE_URL 
} from "@/lib/image-utils"

interface BreadcrumbsProps {
  categoryName: string
  categoryId?: string
}

// Category image helper for breadcrumbs
function CategoryBreadcrumbImage({ categoryId, categoryName }: { categoryId?: string; categoryName: string }) {
  const imageCandidates = useMemo(() => {
    const candidates: string[] = []
    
    if (categoryId) {
      // Try KAOS URLs based on categoryId
      const KAOS_BASE = "https://ishyiga.rw/images_kaos_beta/"
      const sanitizedCategory = categoryId.replace(/[^a-zA-Z0-9]/g, "_")
      
      candidates.push(`${KAOS_BASE}${sanitizedCategory}.jpg`)
      candidates.push(`${KAOS_BASE}category_${sanitizedCategory}.jpg`)
      
      // Add fallback to static images
      const staticImages = [
        `/${categoryId}.jpg`,
        `/${categoryId}.png`,
        `/category-${categoryId}.jpg`,
        `/category-${categoryId}.png`,
      ]
      
      staticImages.forEach(img => {
        if (isValidImageUrl(img)) {
          candidates.push(img)
        }
      })
    }
    
    // Final fallback
    candidates.push(NO_IMAGE_URL)
    
    // Remove duplicates and filter valid URLs
    const seen = new Set<string>()
    return candidates.filter(url => {
      if (!isValidImageUrl(url) || seen.has(url)) return false
      seen.add(url)
      return true
    })
  }, [categoryId])

  const [candidateIdx, setCandidateIdx] = useState(0)
  const [imgError, setImgError] = useState(false)
  
  const currentUrl = imageCandidates[Math.min(candidateIdx, imageCandidates.length - 1)] || NO_IMAGE_URL
  
  // Reset when image candidates change
  useEffect(() => {
    setImgError(false)
    setCandidateIdx(0)
  }, [imageCandidates.join("\x1e")])

  const handleError = () => {
    if (candidateIdx + 1 < imageCandidates.length) {
      setCandidateIdx(prev => prev + 1)
    } else {
      setImgError(true)
    }
  }

  const displayUrl = imgError ? NO_IMAGE_URL : currentUrl

  return (
    <div className="relative w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
      <Image
        src={displayUrl}
        alt={categoryName}
        fill
        className="object-cover"
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

export function Breadcrumbs({ categoryName, categoryId }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
        <span>Home</span>
      </Link>
      <ChevronRight className="h-4 w-4" />
      {categoryId && (
        <>
          <CategoryBreadcrumbImage categoryId={categoryId} categoryName={categoryName} />
          <ChevronRight className="h-4 w-4" />
        </>
      )}
      <span className="text-foreground font-medium">{categoryName}</span>
    </nav>
  )
}
