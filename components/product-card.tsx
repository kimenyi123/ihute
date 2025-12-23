"use client"

import { useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { useFavoritesStore } from "@/lib/favorites-store"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"   // 👈 add

type Product = {
  id: string
  name: string
  description?: string
  price: number
  unit?: string
  inStock?: boolean
  rating?: number
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  image?: string
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)
  const { toast } = useToast()                              // 👈 add

  const {
    id,
    name,
    description,
    price,
    unit,
    supplierId,
    supplierName,
    supplierLocation,
    momo,
    image,
  } = product

  const fav = isFavorite(id)

  // Track product view when component mounts
  useEffect(() => {
    trackProductView(id, name, {
      supplierId,
      categoryId: undefined, // Add if available
    })
  }, [id, name, supplierId])

  return (
    <Card className="group h-full overflow-hidden transition-all hover:shadow-lg">
      <div className="relative w-full aspect-square bg-muted">
        <Image
          fill
          src={image || "/placeholder.svg?height=300&width=300"}
          alt={name}
          className="object-cover"
        />

        {/* Heart overlay */}
        <button
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const wasFav = isFavorite(id)
            toggleFavorite({
              id,
              name,
              price,
              unit,
              image,
              description,
              supplierId,
              supplierName,
              supplierLocation,
              momo,
            })
            toast({
              title: wasFav ? "Removed from favorites" : "Added to favorites!",
              description: name,
              duration: 1500,
            })
          }}
          className={cn(
            "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/90 backdrop-blur transition",
            "hover:bg-white",
            fav ? "text-red-600" : "text-muted-foreground"
          )}
          title={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("h-4 w-4", fav && "fill-current")} />
        </button>
      </div>

      <CardContent className="p-3 flex flex-col gap-2">
        <div className="min-h-[38px]">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{name}</h3>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {description || "Quality product"}
        </p>

        <div className="text-sm">
          <div className="font-semibold">
            {price.toLocaleString()}{" "}
            <span className="text-muted-foreground">{unit ? ` / ${unit}` : ""}</span>
          </div>
          {supplierName && (
            <div className="text-xs text-muted-foreground">
              {supplierName}
              {supplierLocation ? ` — ${supplierLocation}` : ""}
            </div>
          )}
        </div>

        <Button
          size="sm"
          className="mt-1"
          onClick={() => {
            // Track click
            trackClick("product", id, name)
            
            addItem(
              {
                id,
                name,
                price,
                unit,
                image,
                supplierId: supplierId || "unknown",
                supplierName: supplierName || "Supplier",
                supplierLocation,
                momo,
                selectedUnit: unit,
              },
              1
            )
            router.push("/cart")
          }}
        >
          Buy
        </Button>
      </CardContent>
    </Card>
  )
}
