"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/hooks/use-translation"
import type { TranslationKey } from "@/lib/translations"
import { cn } from "@/lib/utils"
import { fetchSectorStatsFromApi, normalizeListSuppliersPayload } from "@/lib/fetch-suggestions-helpers"

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

interface SectorTotals {
  shops: number
  items: number
}

const defaultCategories: Category[] = [
  { categoryId: "pharmacy", nameKey: "pharmacy", descKey: "pharmacyDesc", imageUrl: "/pharmacy-medicine-pills-bottles.jpg", colorClass: "bg-blue-500/10" },
  { categoryId: "liquor-store", nameKey: "liquorStore", descKey: "liquorStoreDesc", imageUrl: "/wine-bottles-liquor-store.jpg", colorClass: "bg-purple-500/10" },
  { categoryId: "boutique", nameKey: "boutique", descKey: "boutiqueDesc", imageUrl: "/fashion-clothing-boutique-store.jpg", colorClass: "bg-pink-500/10" },
  { categoryId: "bar-resto", nameKey: "barResto", descKey: "barRestoDesc", imageUrl: "/restaurant-food-dining-bar.jpg", colorClass: "bg-orange-500/10" },
  { categoryId: "supermarket", nameKey: "supermarket", descKey: "supermarketDesc", imageUrl: "/supermarket-groceries-shopping-cart.jpg", colorClass: "bg-green-500/10" },
  { categoryId: "coffee-shop", nameKey: "coffeeShop", descKey: "coffeeShopDesc", imageUrl: "/coffee-shop-cafe-espresso.jpg", colorClass: "bg-amber-500/10" },
  { categoryId: "beauty", nameKey: "beauty", descKey: "beautyDesc", imageUrl: "/beauty-cosmetics-makeup-products.jpg", colorClass: "bg-rose-500/10" },
  { categoryId: "general", nameKey: "generalStore", descKey: "generalStoreDesc", imageUrl: "/general-store-retail-products.jpg", colorClass: "bg-slate-500/10" },
]

const LIST_SUPPLIERS_LIMIT = 500

function pickSupplierItemCount(x: Record<string, unknown>): number {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0)
  const pc = num(x.product_count) || num(x.productCount) || num(x.PRODUCT_COUNT)
  if (pc > 0) return pc
  if (Array.isArray(x.products)) return x.products.length
  return num(x.in_stock_products) || num(x.inStockProducts) || 0
}

async function fetchSectorTotals(sectorId: string): Promise<SectorTotals> {
  const sid = sectorId.trim().toLowerCase()
  if (!sid) return { shops: 0, items: 0 }
  const fromStats = await fetchSectorStatsFromApi(sid)
  if (fromStats) return fromStats
  const url = `/api/sector-list-suppliers?sector=${encodeURIComponent(sid)}&Currency=RWF&limit=${LIST_SUPPLIERS_LIMIT}`
  const r = await fetch(url, { cache: "no-store" })
  const parsed = r.ok ? await r.json().catch(() => []) : []
  const list: any[] = normalizeListSuppliersPayload(parsed) as any[]
  let items = 0
  for (const row of list) {
    items += pickSupplierItemCount(row as Record<string, unknown>)
  }
  return { shops: list.length, items }
}

/** Category grid that links to /category_ai/[categoryId] (enhanced category pages). */
export function CategoryGridAI({ showHeading = true }: { showHeading?: boolean }) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>(defaultCategories)
  const [sectorStats, setSectorStats] = useState<Record<string, SectorTotals>>({})
  const [statsLoading, setStatsLoading] = useState(true)

  /** Sorted lowercase ids so the stats effect key is stable if API reorder changes. */
  const categoryIdsKey = useMemo(
    () => [...new Set(categories.map((c) => c.categoryId.toLowerCase()))].sort().join("|"),
    [categories]
  )

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getHomepageCategories" }),
        })
        const data = await res.json()
        if (!isMounted || !res.ok) return
        if (data.ok && data.categories?.length > 0) {
          const active = data.categories
            .filter((cat: Category) => cat.isActive !== false && (cat as any).sellerCount > 0)
            .sort((a: Category, b: Category) => (a.displayOrder || 0) - (b.displayOrder || 0))
          const barRestoIds = ["resto-bar", "barrestaurant", "bar_resto", "barresto", "bar-resto"]
          const canonicalBarResto = defaultCategories.find((c) => c.categoryId === "bar-resto")
          const rest = active.filter((cat: Category) => !barRestoIds.includes((cat.categoryId || "").toLowerCase()))
          const firstBarResto = active.find((cat: Category) => barRestoIds.includes((cat.categoryId || "").toLowerCase()))
          const merged =
            firstBarResto && canonicalBarResto
              ? [...rest, { ...canonicalBarResto, ...firstBarResto, categoryId: "bar-resto", nameKey: "barResto", descKey: "barRestoDesc", imageUrl: canonicalBarResto.imageUrl }]
              : firstBarResto
                ? [...rest, { ...firstBarResto, categoryId: "bar-resto", nameKey: "barResto", descKey: "barRestoDesc", imageUrl: defaultCategories.find((c) => c.categoryId === "bar-resto")?.imageUrl ?? firstBarResto.imageUrl }]
                : rest
          setCategories(merged)
        }
      } catch (e) {
        if (isMounted) setCategories(defaultCategories)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!categoryIdsKey) return
    let cancelled = false
    const ids = categoryIdsKey.split("|").filter(Boolean)

    async function loadStats() {
      setStatsLoading(true)
      const next: Record<string, SectorTotals> = {}
      try {
        await Promise.all(
          ids.map(async (id) => {
            try {
              const totals = await fetchSectorTotals(id)
              if (!cancelled) next[id] = totals
            } catch {
              if (!cancelled) next[id] = { shops: 0, items: 0 }
            }
          })
        )
        if (!cancelled) setSectorStats(next)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    loadStats()
    return () => {
      cancelled = true
    }
  }, [categoryIdsKey])

  return (
    <section className="py-8 md:py-12 bg-slate-50/50">
      <div className="container mx-auto px-4">
        {showHeading && (
          <div className="mb-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("shopByCategory")}</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">{t("findWhatYouNeed")}</p>
          </div>
        )}
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No categories available at the moment.</div>
        ) : (
          <div
            className={cn(
              "grid gap-3 sm:gap-4 justify-items-stretch",
              "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            )}
          >
            {categories.map((category) => {
              const idKey = category.categoryId.toLowerCase()
              const stat = sectorStats[idKey]
              return (
                <Link key={category.categoryId} href={`/category_ai/${category.categoryId}`} className="min-w-0 h-full block">
                  <Card
                    className={cn(
                      "group h-full w-full flex flex-col overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02]",
                      "min-h-[288px] h-[300px] sm:h-[320px]"
                    )}
                  >
                    <CardContent className="flex flex-col flex-1 min-h-0 p-3 md:p-4 text-center">
                      <div
                        className={cn(
                          "shrink-0 w-full overflow-hidden rounded-xl relative",
                          "h-[100px] sm:h-[112px] md:h-[120px]",
                          category.colorClass || "bg-gray-500/10"
                        )}
                      >
                        <Image
                          src={category.imageUrl || "/placeholder.svg"}
                          alt={t(category.nameKey as TranslationKey)}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-h-0 pt-2 md:pt-3">
                        <h3 className="text-xs md:text-sm font-semibold text-foreground group-hover:text-primary line-clamp-2 min-h-[2.5rem] flex items-start justify-center leading-tight">
                          {t(category.nameKey as TranslationKey)}
                        </h3>
                        {category.descKey && (
                          <p className="mt-1 text-[10px] md:text-xs text-muted-foreground line-clamp-2 min-h-[2.25rem] leading-snug">
                            {t(category.descKey as TranslationKey)}
                          </p>
                        )}
                        <div className="mt-auto pt-2 border-t border-border/60 shrink-0">
                          {statsLoading || stat == null ? (
                            <p className="text-[10px] md:text-xs text-muted-foreground tabular-nums animate-pulse">…</p>
                          ) : (
                            <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">
                              <strong className="font-bold text-foreground tabular-nums">{stat.shops}</strong>{" "}
                              {t("sectorPanelShops" as TranslationKey)}
                              <span className="mx-1 text-muted-foreground/80" aria-hidden>
                                ·
                              </span>
                              <strong className="font-bold text-foreground tabular-nums">{stat.items}</strong>{" "}
                              {t("sectorPanelItems" as TranslationKey)}
                            </p>
                          )}
                        </div>
                      </div>
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
