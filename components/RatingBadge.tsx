"use client"

import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Props {
    rating: number
    totalRatings: number
    size?: "sm" | "md" | "lg"
    showCount?: boolean
    variant?: "default" | "compact"
}

export function RatingBadge({
    rating,
    totalRatings,
    size = "md",
    showCount = true,
    variant = "default"
}: Props) {
    const getStarSize = () => {
        switch (size) {
            case "sm": return "h-3 w-3"
            case "md": return "h-4 w-4"
            case "lg": return "h-5 w-5"
        }
    }

    const getTextSize = () => {
        switch (size) {
            case "sm": return "text-xs"
            case "md": return "text-sm"
            case "lg": return "text-base"
        }
    }

    // Determine badge variant based on rating
    const getBadgeVariant = (): "default" | "secondary" | "outline" => {
        if (rating >= 4.5) return "default" // Top rated
        if (totalRatings < 5) return "secondary" // New seller
        return "outline" // Regular
    }

    const getBadgeText = () => {
        if (totalRatings < 5) return "New Seller"
        if (rating >= 4.5) return "Top Rated"
        return null
    }

    const starClass = getStarSize()
    const textClass = getTextSize()

    if (variant === "compact") {
        // Compact version for inline display
        return (
            <div className="inline-flex items-center gap-1">
                <Star className={`${starClass} fill-yellow-400 text-yellow-400`} />
                <span className={`${textClass} font-medium`}>{rating.toFixed(1)}</span>
                {showCount && (
                    <span className={`${textClass} text-muted-foreground`}>({totalRatings})</span>
                )}
            </div>
        )
    }

    // Default badge version
    const badgeText = getBadgeText()

    return (
        <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-background border rounded-md">
                <Star className={`${starClass} fill-yellow-400 text-yellow-400`} />
                <span className={`${textClass} font-medium`}>{rating.toFixed(1)}</span>
                {showCount && (
                    <span className={`${textClass} text-muted-foreground ml-1`}>({totalRatings})</span>
                )}
            </div>
            {badgeText && (
                <Badge variant={getBadgeVariant()}>
                    {badgeText}
                </Badge>
            )}
        </div>
    )
}
