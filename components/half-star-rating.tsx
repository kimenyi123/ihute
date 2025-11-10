"use client"

import { Star } from "lucide-react"
import { useState } from "react"

interface HalfStarRatingProps {
  value: number
  onChange: (value: number) => void
  maxStars?: number
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  showValue?: boolean
}

export function HalfStarRating({
  value,
  onChange,
  maxStars = 5,
  size = "md",
  disabled = false,
  showValue = true,
}: HalfStarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number>(0)

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  }

  const starSize = sizeClasses[size]

  const handleClick = (starIndex: number, half: boolean) => {
    if (disabled) return
    const newValue = starIndex + (half ? 0.5 : 0)
    onChange(newValue)
  }

  const handleMouseEnter = (starIndex: number, half: boolean) => {
    if (disabled) return
    setHoverValue(starIndex + (half ? 0.5 : 0))
  }

  const handleMouseLeave = () => {
    if (disabled) return
    setHoverValue(0)
  }

  const displayValue = hoverValue || value

  return (
    <div className="flex items-center gap-1">
      <div className="flex relative" onMouseLeave={handleMouseLeave}>
        {Array.from({ length: maxStars }, (_, i) => (
          <div key={i} className="relative inline-block">
            {/* Empty star background */}
            <button
              type="button"
              className="relative block"
              onClick={() => handleClick(i, false)}
              onMouseEnter={() => handleMouseEnter(i, false)}
              disabled={disabled}
            >
              <Star className={`${starSize} text-slate-300 fill-slate-100`} />
            </button>

            {/* Half star overlay */}
            <button
              type="button"
              className="absolute left-0 top-0 w-1/2 overflow-hidden block"
              onClick={() => handleClick(i, true)}
              onMouseEnter={() => handleMouseEnter(i, true)}
              disabled={disabled}
            >
              <Star className={`${starSize} text-yellow-400 ${displayValue >= i + 0.5 ? "fill-yellow-400" : ""}`} />
            </button>

            {/* Full star overlay */}
            <button
              type="button"
              className="absolute left-0 top-0 w-full block"
              onClick={() => handleClick(i, false)}
              onMouseEnter={() => handleMouseEnter(i, false)}
              disabled={disabled}
            >
              <Star
                className={`${starSize} text-yellow-400 ${displayValue >= i + 1 ? "fill-yellow-400" : "fill-transparent"}`}
              />
            </button>
          </div>
        ))}
      </div>
      {showValue && value > 0 && (
        <span className="ml-2 text-sm font-medium text-slate-700">
          {value.toFixed(1)}/{maxStars}
        </span>
      )}
    </div>
  )
}

