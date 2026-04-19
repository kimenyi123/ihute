"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { MapPin } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useProductFiltersStore } from "@/lib/product-filters-store"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { LocationBadge } from "@/components/location-badge"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/hooks/use-translation"
import type { TranslationKey } from "@/lib/translations"

const PRICE_SLIDER_MIN = 500
const PRICE_SLIDER_MAX = 500_000

const SECTORS = [
  { id: "pharmacy", label: "Pharmacy" },
  { id: "liquor-store", label: "Liquor Store" },
  { id: "boutique", label: "Boutique" },
  { id: "bar-resto", label: "Bar & Restaurant" },
  { id: "supermarket", label: "Supermarket" },
  { id: "coffee-shop", label: "Coffee Shop" },
  { id: "beauty", label: "Beauty" },
  { id: "general", label: "General" },
]

const CATEGORIES = [
  { id: "drugs", label: "Drugs" },
  { id: "beer", label: "Beer" },
  { id: "wines", label: "Wines" },
  { id: "bbq", label: "BBQ" },
  { id: "beverages", label: "Beverages" },
  { id: "food", label: "Food" },
  { id: "cosmetics", label: "Cosmetics" },
  { id: "household", label: "Household" },
]

const BRANDS = [
  { id: "heineken", label: "Heineken" },
  { id: "leffe", label: "Leffe" },
  { id: "primus", label: "Primus" },
  { id: "mutzig", label: "Mutzig" },
  { id: "coca-cola", label: "Coca-Cola" },
  { id: "pepsi", label: "Pepsi" },
]

interface ProductFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORY_ITEM_SORT: { value: string; labelKey: TranslationKey }[] = [
  { value: "price-low", labelKey: "filterSortPriceLow" },
  { value: "featured", labelKey: "filterSortFeatured" },
  { value: "trending", labelKey: "categoryBrowseTrendingSort" },
  { value: "price-high", labelKey: "filterSortPriceHigh" },
  { value: "newest", labelKey: "filterSortNewest" },
  { value: "rating", labelKey: "filterSortRating" },
]

export function ProductFiltersSheet({ open, onOpenChange }: ProductFiltersSheetProps) {
  const router = useRouter()
  const pathname = usePathname() || ""
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { location } = useLocationStoreEnhanced()

  const isCategoryItemBrowse =
    pathname.startsWith("/category_ai/") && searchParams.get("browse") === "item"

  const currentSort = searchParams.get("sort") || "price-low"

  const setCategoryItemSort = (sort: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set("sort", sort)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }
  const {
    sector,
    category,
    brand,
    priceMin,
    priceMax,
    setSector,
    setCategory,
    setBrand,
    setPriceMin,
    setPriceMax,
    clearAll,
    hasActiveFilters,
  } = useProductFiltersStore()

  const sliderValue = useMemo((): [number, number] => {
    const min = parseInt(priceMin, 10) || PRICE_SLIDER_MIN
    const max = parseInt(priceMax, 10) || PRICE_SLIDER_MAX
    const a = Math.max(PRICE_SLIDER_MIN, Math.min(min, PRICE_SLIDER_MAX))
    const b = Math.min(PRICE_SLIDER_MAX, Math.max(max, PRICE_SLIDER_MIN))
    return a <= b ? [a, b] : [Math.min(a, b), Math.max(a, b)]
  }, [priceMin, priceMax])

  const onSliderChange = (v: number[]) => {
    const [min, max] = v
    setPriceMin(String(min))
    setPriceMax(String(max))
  }

  // Placeholder price distribution bars (replace with real product counts later)
  const histogramBars = useMemo(() => {
    const bars = 12
    return Array.from({ length: bars }, (_, i) => ({
      h: 40 + Math.floor(Math.random() * 60),
      key: i,
    }))
  }, [])

  const handleShowProducts = () => {
    if (isCategoryItemBrowse) {
      onOpenChange(false)
      return
    }
    const params = new URLSearchParams()
    if (sector) params.set("sector", sector)
    if (category) params.set("category", category)
    if (brand) params.set("brand", brand)
    if (priceMin) params.set("priceMin", priceMin)
    if (priceMax) params.set("priceMax", priceMax)
    if (location?.district) params.set("district", location.district)
    if (location?.cell) params.set("cell", location.cell)
    onOpenChange(false)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-8 py-6 px-1">
          {isCategoryItemBrowse && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold block">{t("filterSheetSortProducts" as TranslationKey)}</Label>
              <p className="text-xs text-muted-foreground mb-2">{t("filterSheetSortHint" as TranslationKey)}</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ITEM_SORT.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategoryItemSort(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm transition-colors",
                      currentSort === opt.value
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Location
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Products and suppliers near you
            </p>
            <LocationBadge />
          </div>

          {/* Sector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold block">Sector</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSector("")}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm",
                  !sector ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                )}
              >
                Any
              </button>
              {SECTORS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSector(sector === s.id ? "" : s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm",
                    sector === s.id ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold block">Category</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm",
                  !category ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                )}
              >
                Any
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(category === c.id ? "" : c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm",
                    category === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold block">Brand</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBrand("")}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm",
                  !brand ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                )}
              >
                Any
              </button>
              {BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrand(brand === b.id ? "" : b.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm",
                    brand === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold block">Price range (RWF)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              500 – 500,000 RWF (covers high-value items; distribution bars are placeholder until product prices are fetched)
            </p>
            <div className="h-8 flex items-end gap-0.5 mb-3">
              {histogramBars.map((b) => (
                <div
                  key={b.key}
                  className="flex-1 rounded-t bg-primary/30 min-w-[4px]"
                  style={{ height: `${b.h}%` }}
                />
              ))}
            </div>
            <Slider
              min={PRICE_SLIDER_MIN}
              max={PRICE_SLIDER_MAX}
              step={100}
              value={sliderValue}
              onValueChange={onSliderChange}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Min {sliderValue[0].toLocaleString()} RWF</span>
              <span>Max {sliderValue[1].toLocaleString()} RWF</span>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t pt-4 mt-auto sticky bottom-0 bg-background pb-4">
          <Button variant="ghost" className="mr-auto" onClick={clearAll}>
            Clear all
          </Button>
          <Button onClick={handleShowProducts}>
            {isCategoryItemBrowse
              ? t("filterSheetDone" as TranslationKey)
              : hasActiveFilters()
                ? "Show products"
                : "Browse all"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
