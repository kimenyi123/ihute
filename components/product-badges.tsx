"use client"

import { cn } from "@/lib/utils"
import { MapPin, BadgeCheck, TrendingUp, AlertCircle, Percent, Star } from "lucide-react"

export type ProductBadgeType =
  | "best-price"
  | "nearby"
  | "low-stock"
  | "fast-moving"
  | "discount"
  | "verified-seller"
  | "margin"

const BADGE_CONFIG: Record<
  ProductBadgeType,
  { label: string; icon: React.ReactNode; className: string }
> = {
  "best-price": {
    label: "Best price nearby",
    icon: <span className="text-[10px]">🔥</span>,
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  nearby: {
    label: "Nearby",
    icon: <MapPin className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  "low-stock": {
    label: "Low Stock",
    icon: <span className="text-[10px]">⚡</span>,
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  "fast-moving": {
    label: "Fast Moving",
    icon: <TrendingUp className="h-3 w-3" />,
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  discount: {
    label: "Discount",
    icon: <Percent className="h-3 w-3" />,
    className: "bg-rose-100 text-rose-800 border-rose-200",
  },
  "verified-seller": {
    label: "Verified",
    icon: <BadgeCheck className="h-3 w-3" />,
    className: "bg-slate-100 text-slate-800 border-slate-200",
  },
  margin: {
    label: "% margin",
    icon: <span className="text-[10px]">💰</span>,
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
}

interface ProductBadgesProps {
  badges: ProductBadgeType[]
  max?: number
  className?: string
  stockQuantity?: number
  marginPercent?: number
  /** e.g. "1.2km away" for Best Deals style */
  distanceLabel?: string
}

/** Reusable badge row for product cards. Renders up to max badges when data exists. */
export function ProductBadges({ badges, max = 4, className, stockQuantity, marginPercent, distanceLabel }: ProductBadgesProps) {
  const toShow = badges.slice(0, max)
  if (toShow.length === 0) return null
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {toShow.map((type) => {
        const config = BADGE_CONFIG[type]
        if (!config) return null
        let label = config.label
        if (type === "low-stock" && stockQuantity != null) label = `Only ${stockQuantity} left`
        if (type === "margin" && marginPercent != null) label = `${marginPercent}% margin`
        if (type === "nearby" && distanceLabel) label = distanceLabel
        return (
          <span
            key={type}
            className={cn(
              "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              config.className
            )}
          >
            {config.icon}
            {label}
          </span>
        )
      })}
    </div>
  )
}

/** Optional trust line: rating + review count. Hide when absent. */
export function ProductTrustSignals({
  rating,
  reviewCount,
  verifiedSeller,
  className,
}: {
  rating?: number | null
  reviewCount?: number | null
  verifiedSeller?: boolean | null
  className?: string
}) {
  const hasRating = typeof rating === "number" && rating >= 0 && rating <= 5
  const hasReviews = typeof reviewCount === "number" && reviewCount > 0
  const hasVerified = verifiedSeller === true
  if (!hasRating && !hasReviews && !hasVerified) return null
  return (
    <div className={cn("flex items-center gap-2 text-[10px] text-muted-foreground", className)}>
      {hasRating && (
        <span className="inline-flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {rating.toFixed(1)}
        </span>
      )}
      {hasReviews && <span>{reviewCount} reviews</span>}
      {hasVerified && (
        <span className="inline-flex items-center gap-0.5 text-emerald-600">
          <BadgeCheck className="h-3 w-3" />
          Verified
        </span>
      )}
    </div>
  )
}
