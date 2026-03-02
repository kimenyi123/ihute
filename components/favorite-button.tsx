"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFavoritesStore, type FavoriteItem } from "@/lib/favorites-store"
import { useAuthStore } from "@/lib/auth-store"
import { addFavoriteApi, removeFavoriteApi } from "@/lib/favorites-api"
import { useToast } from "@/components/ui/use-toast"

type FavoriteButtonProps = {
  item: FavoriteItem
  className?: string
  iconClassName?: string
}

export function FavoriteButton({ item, className, iconClassName }: FavoriteButtonProps) {
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuthStore()
  const addFavorite = useFavoritesStore((s) => s.addFavorite)
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)

  const [loading, setLoading] = useState(false)
  const fav = isFavorite(item.id, item.supplierId)

  const handleToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading) return
    setLoading(true)

    try {
      if (isAuthenticated && user) {
        if (!item.supplierId) {
          throw new Error("Supplier is missing for this product")
        }
        if (fav) {
          await removeFavoriteApi({ productId: item.id, supplierId: item.supplierId })
          removeFavorite(item.id, item.supplierId)
        } else {
          const res = await addFavoriteApi({
            productId: item.id,
            supplierId: item.supplierId,
            clientPrice: item.price,
          })
          addFavorite({
            ...item,
            addedAt: res?.favoriteItem?.addedAt || item.addedAt,
          })
        }
      } else {
        if (fav) removeFavorite(item.id, item.supplierId)
        else addFavorite(item)
      }

      toast({
        title: fav ? "Removed from favorites" : "Added to favorites!",
        description: item.name,
        duration: 1500,
      })
    } catch (err: any) {
      toast({
        title: "Couldn't update favorites",
        description: err?.message || "Please try again",
        duration: 2000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/90 backdrop-blur transition",
        "hover:bg-white disabled:opacity-70",
        fav ? "text-red-600" : "text-muted-foreground",
        className
      )}
      title={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={cn("h-4 w-4", fav && "fill-current", iconClassName)} />
    </button>
  )
}
