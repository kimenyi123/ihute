"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/hooks/use-translation"

interface Category {
  id?: number
  categoryId: string
  nameKey: string
  descKey: string
  imageUrl: string
  colorClass: string
  displayOrder?: number
  isActive?: boolean
}

// Default categories as fallback
const defaultCategories: Category[] = [
  {
    categoryId: "pharmacy",
    nameKey: "pharmacy",
    descKey: "pharmacyDesc",
    imageUrl: "/pharmacy-medicine-pills-bottles.jpg",
    colorClass: "bg-blue-500/10",
  },
  {
    categoryId: "liquor-store",
    nameKey: "liquorStore",
    descKey: "liquorStoreDesc",
    imageUrl: "/wine-bottles-liquor-store.jpg",
    colorClass: "bg-purple-500/10",
  },
  {
    categoryId: "boutique",
    nameKey: "boutique",
    descKey: "boutiqueDesc",
    imageUrl: "/fashion-clothing-boutique-store.jpg",
    colorClass: "bg-pink-500/10",
  },
  {
    categoryId: "bar-resto",
    nameKey: "barResto",
    descKey: "barRestoDesc",
    imageUrl: "/restaurant-food-dining-bar.jpg",
    colorClass: "bg-orange-500/10",
  },
  {
    categoryId: "supermarket",
    nameKey: "supermarket",
    descKey: "supermarketDesc",
    imageUrl: "/supermarket-groceries-shopping-cart.jpg",
    colorClass: "bg-green-500/10",
  },
  {
    categoryId: "coffee-shop",
    nameKey: "coffeeShop",
    descKey: "coffeeShopDesc",
    imageUrl: "/coffee-shop-cafe-espresso.jpg",
    colorClass: "bg-amber-500/10",
  },
  {
    categoryId: "beauty",
    nameKey: "beauty",
    descKey: "beautyDesc",
    imageUrl: "/beauty-cosmetics-makeup-products.jpg",
    colorClass: "bg-rose-500/10",
  },
  {
    categoryId: "general",
    nameKey: "generalStore",
    descKey: "generalStoreDesc",
    imageUrl: "/general-store-retail-products.jpg",
    colorClass: "bg-slate-500/10",
  },
]

export function CategoryGrid() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>(defaultCategories)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      // Fetch from public API endpoint (no auth required for homepage)
      const requestBody = { action: 'getHomepageCategories' }
      console.log('[CategoryGrid] Requesting categories with body:', requestBody)
      
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      const data = await res.json()
      console.log('[CategoryGrid] Response status:', res.status)
      console.log('[CategoryGrid] Response data:', data)
      
      if (!res.ok) {
        console.error('[CategoryGrid] API error:', data.error, data)
        // Keep default categories on error
        return
      }
      
      if (data.ok && data.categories && data.categories.length > 0) {
        // Filter only active categories that have suppliers, and sort by display order
        const activeCategories = data.categories
          .filter((cat: Category) => cat.isActive !== false && (cat as any).sellerCount > 0)
          .sort((a: Category, b: Category) => (a.displayOrder || 0) - (b.displayOrder || 0))
        setCategories(activeCategories)
      }
    } catch (error) {
      console.error('[CategoryGrid] Error loading categories:', error)
      // Keep default categories on error
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="py-8 md:py-12 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-500">Loading categories...</div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-8 md:py-12 bg-slate-50/50">
      <div className="container mx-auto px-4">
        <div className="mb-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("shopByCategory")}</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{t("findWhatYouNeed")}</p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No categories available at the moment.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center items-start gap-3 sm:gap-4 md:gap-5">
            {categories.map((category) => {
              // Calculate responsive width based on category count
              const getCategoryWidth = () => {
                const count = categories.length
                if (count === 1) return "w-full max-w-[280px]"
                if (count === 2) return "w-full sm:w-[calc(50%-0.75rem)] max-w-[240px]"
                if (count === 3) return "w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] max-w-[220px]"
                if (count === 4) return "w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1rem)] max-w-[200px]"
                if (count <= 6) return "w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1rem)] xl:w-[calc(20%-1rem)] max-w-[180px]"
                return "w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1rem)] xl:w-[calc(20%-1rem)] 2xl:w-[calc(16.666%-1rem)] max-w-[160px]"
              }
              
              return (
                <Link 
                  key={category.categoryId} 
                  href={`/category/${category.categoryId}`}
                  className={getCategoryWidth()}
                >
                  <Card className="group h-full transition-all hover:shadow-lg hover:scale-105 overflow-hidden">
                    <CardContent className="flex flex-col items-center justify-center p-3 md:p-4 text-center">
                      <div className={`mb-2 rounded-xl overflow-hidden ${category.colorClass || "bg-gray-500/10"} w-full aspect-square relative`}>
                        <Image
                          src={category.imageUrl || "/placeholder.svg"}
                          alt={t(category.nameKey)}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <h3 className="text-xs md:text-sm font-semibold text-foreground group-hover:text-primary line-clamp-2">
                        {t(category.nameKey)}
                      </h3>
                      {category.descKey && (
                        <p className="mt-1 text-[10px] md:text-xs text-muted-foreground line-clamp-1 hidden sm:block">
                          {t(category.descKey)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
