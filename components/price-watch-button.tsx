"use client"

import { Button } from "@/components/ui/button"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { DEFAULT_CURRENCY } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import { Eye, EyeOff } from "lucide-react"

type Props = {
  productId: string
  supplierId: string
  name: string
  currentPrice: number
  supplierName?: string
  /** Image URL from backend (image_url / item_image_url), same as /search and shop-with-me. */
  image?: string
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "ghost" | "outline" | "link" | "default" | "secondary" | "destructive"
}

export function PriceWatchButton({
  productId,
  supplierId,
  name,
  currentPrice,
  supplierName,
  image,
  className,
  size = "sm",
  variant = "ghost",
}: Props) {
  const { isWatched, addWatch, removeWatch } = usePriceWatchStore()
  const { toast } = useToast()
  const watched = isWatched(productId, supplierId)

  const handleClick = () => {
    if (watched) {
      removeWatch(productId, supplierId)
      toast({ title: "Removed from price watch", description: name })
    } else {
      addWatch({
        productId,
        supplierId,
        name,
        priceWhenWatched: currentPrice,
        supplierName,
        image,
        image_url: image,
      })
      toast({ title: "Watching price", description: `We'll notify you if ${name} drops below ${currentPrice.toLocaleString()} ${DEFAULT_CURRENCY}` })
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      title={watched ? "Stop watching price" : "Notify me when price drops"}
      aria-label={watched ? "Stop watching price" : "Watch price"}
    >
      {watched ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  )
}
