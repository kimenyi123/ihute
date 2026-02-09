"use client"

import { useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/cart-store"
import { FavoriteButton } from "@/components/favorite-button"
import { trackProductView, trackClick } from "@/lib/interaction-tracker"
import { useToast } from "@/components/ui/use-toast"

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
  const addItem = useCartStore((s) => s.addItem)
  const { toast } = useToast()

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
        <FavoriteButton
          className="absolute right-2 top-2"
          item={{
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
          }}
        />
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
            
            // Show success toast instead of redirecting
            toast({
              title: "Added to cart!",
              description: name,
              duration: 2000,
            })
          }}
        >
          Buy
        </Button>
      </CardContent>
    </Card>
  )
}
