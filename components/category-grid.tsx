"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/hooks/use-translation"

const categories = [
  {
    id: "pharmacy",
    nameKey: "pharmacy" as const,
    descKey: "pharmacyDesc" as const,
    image: "/pharmacy-medicine-pills-bottles.jpg",
    color: "bg-blue-500/10",
  },
  {
    id: "liquor-store",
    nameKey: "liquorStore" as const,
    descKey: "liquorStoreDesc" as const,
    image: "/wine-bottles-liquor-store.jpg",
    color: "bg-purple-500/10",
  },
  {
    id: "boutique",
    nameKey: "boutique" as const,
    descKey: "boutiqueDesc" as const,
    image: "/fashion-clothing-boutique-store.jpg",
    color: "bg-pink-500/10",
  },
  {
    id: "bar-resto",
    nameKey: "barResto" as const,
    descKey: "barRestoDesc" as const,
    image: "/restaurant-food-dining-bar.jpg",
    color: "bg-orange-500/10",
  },
  {
    id: "supermarket",
    nameKey: "supermarket" as const,
    descKey: "supermarketDesc" as const,
    image: "/supermarket-groceries-shopping-cart.jpg",
    color: "bg-green-500/10",
  },
  {
    id: "coffee-shop",
    nameKey: "coffeeShop" as const,
    descKey: "coffeeShopDesc" as const,
    image: "/coffee-shop-cafe-espresso.jpg",
    color: "bg-amber-500/10",
  },
  {
    id: "beauty",
    nameKey: "beauty" as const,
    descKey: "beautyDesc" as const,
    image: "/beauty-cosmetics-makeup-products.jpg",
    color: "bg-rose-500/10",
  },
  {
    id: "general",
    nameKey: "generalStore" as const,
    descKey: "generalStoreDesc" as const,
    image: "/general-store-retail-products.jpg",
    color: "bg-slate-500/10",
  },
]

export function CategoryGrid() {
  const { t } = useTranslation()

  return (
    <section className="py-8 md:py-12 bg-slate-50/50">
      <div className="container mx-auto px-4">
        <div className="mb-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("shopByCategory")}</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{t("findWhatYouNeed")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => {
            return (
              <Link key={category.id} href={`/category/${category.id}`}>
                <Card className="group h-full transition-all hover:shadow-lg hover:scale-105 overflow-hidden">
                  <CardContent className="flex flex-col items-center justify-center p-3 md:p-4 text-center">
                    <div className={`mb-2 rounded-xl overflow-hidden ${category.color} w-full aspect-square relative`}>
                      <Image
                        src={category.image || "/placeholder.svg"}
                        alt={t(category.nameKey)}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h3 className="text-xs md:text-sm font-semibold text-foreground group-hover:text-primary line-clamp-2">
                      {t(category.nameKey)}
                    </h3>
                    <p className="mt-1 text-[10px] md:text-xs text-muted-foreground line-clamp-1 hidden sm:block">
                      {t(category.descKey)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
