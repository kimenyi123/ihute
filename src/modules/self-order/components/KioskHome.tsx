"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/hooks/use-translation"
import type { TranslationKey } from "@/lib/translations"
import type { KioskCategory, KioskTableInfo } from "@/src/modules/self-order/types"

type HomepageCategory = {
  id?: number
  categoryId: string
  nameKey: string
  descKey: string
  imageUrl: string
  colorClass: string
  displayOrder?: number
  isActive?: boolean
  sellerCount?: number
}

const FALLBACK_TILES: { id: KioskCategory; nameKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: "BAR", nameKey: "barResto", descKey: "barRestoDesc" },
  { id: "RESTRO", nameKey: "barResto", descKey: "barRestoDesc" },
  { id: "COFFEE_SHOP", nameKey: "coffeeShop", descKey: "coffeeShopDesc" },
]

export function KioskHome() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const setTableInfo = useCartStore((s) => s.setTableInfo)
  const clear = useCartStore((s) => s.clear)

  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("dine-in")
  // Editable nickname — pre-fills from URL but user can override it
  const [shopNick, setShopNick] = useState("")
  const [homepageCategories, setHomepageCategories] = useState<HomepageCategory[] | null>(null)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const body = { action: "getHomepageCategories" }
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.ok || !Array.isArray(data.categories)) {
          return
        }
        const active = (data.categories as HomepageCategory[])
          .filter((cat) => cat.isActive !== false && (cat.sellerCount ?? 0) > 0)
        setHomepageCategories(active)
      } catch {
        // Silently fall back to defaults
      }
    }
    loadCategories()
  }, [])

  const tiles = useMemo(
    () => buildKioskTiles(homepageCategories, FALLBACK_TILES),
    [homepageCategories],
  )

  const kioskCategoryFromUrl = useMemo(() => {
    const v = searchParams.get("kioskCategory") as KioskCategory | null
    return v && (v === "BAR" || v === "RESTRO" || v === "COFFEE_SHOP") ? v : "BAR"
  }, [searchParams])

  const nicknameFromUrl = useMemo(() => {
    const v = searchParams.get("nickname")
    return v && v.trim() ? v.trim().toLowerCase() : ""
  }, [searchParams])

  // Pre-fill editable nickname field once on mount (or when URL changes)
  useEffect(() => {
    if (nicknameFromUrl && !shopNick) {
      setShopNick(nicknameFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicknameFromUrl])

  const handleStart = (category: KioskCategory) => {
    const info: KioskTableInfo = {
      tableNumber: tableNumber.trim() || undefined,
      customerName: customerName.trim() || undefined,
      orderType,
    }
    // Fresh cart per kiosk session
    clear()
    setTableInfo(info)
    // Use the manually-typed nickname (always lowercased) if provided,
    // otherwise fall back to category-based kiosk menu.
    const nick = shopNick.trim().toLowerCase()
    if (nick) {
      const sp = new URLSearchParams()
      sp.set("nickname", nick)
      sp.set("kioskCategory", category)
      router.push(`/self-order/menu?${sp.toString()}`)
      return
    }
    router.push(`/self-order/menu?kioskCategory=${encodeURIComponent(category)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-red-50 text-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-5xl w-full space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Welcome to Self‑Order
          </h1>
          <p className="text-slate-600 text-lg">
            Choose your area and start ordering directly from this screen.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="bg-white/90 border border-rose-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Table &amp; guest details (optional)
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-700">Table number</label>
                <Input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 12"
                  className="bg-white border-slate-200 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700">Name (for the order)</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="bg-white border-slate-200 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700">Your shop nickname <span className="text-slate-400 text-xs">(optional — e.g. burrows)</span></label>
                <Input
                  value={shopNick}
                  onChange={(e) => setShopNick(e.target.value)}
                  placeholder="Type your shop/bar nickname"
                  className="bg-white border-slate-200 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-700">Order type</label>
                <div className="inline-flex rounded-full bg-rose-100/80 p-1 border border-rose-200">
                  <button
                    type="button"
                    onClick={() => setOrderType("dine-in")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${orderType === "dine-in"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-rose-900/80 hover:bg-rose-50"
                      }`}
                  >
                    Dine‑in
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("takeaway")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${orderType === "takeaway"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-rose-900/80 hover:bg-rose-50"
                      }`}
                  >
                    Takeaway
                  </button>
                </div>
              </div>
            </div>
          </div>


          <div className="mt-6 flex justify-center">
            <Button
              size="lg"
              className="px-10 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-full"
              onClick={() => handleStart(kioskCategoryFromUrl)}
            >
              Start order
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildKioskTiles(
  homepageCategories: HomepageCategory[] | null,
  fallback: { id: KioskCategory; nameKey: TranslationKey; descKey: TranslationKey }[],
): { id: KioskCategory; nameKey: TranslationKey; descKey: TranslationKey }[] {
  if (!homepageCategories || homepageCategories.length === 0) {
    return fallback
  }

  const barResto = homepageCategories.find((c) => c.categoryId === "bar-resto")
  const coffee = homepageCategories.find((c) => c.categoryId === "coffee-shop")

  const tiles: { id: KioskCategory; nameKey: TranslationKey; descKey: TranslationKey }[] = []

  if (barResto) {
    tiles.push(
      {
        id: "BAR",
        nameKey: barResto.nameKey as TranslationKey,
        descKey: barResto.descKey as TranslationKey,
      },
      {
        id: "RESTRO",
        nameKey: barResto.nameKey as TranslationKey,
        descKey: barResto.descKey as TranslationKey,
      },
    )
  }
  if (coffee) {
    tiles.push({
      id: "COFFEE_SHOP",
      nameKey: coffee.nameKey as TranslationKey,
      descKey: coffee.descKey as TranslationKey,
    })
  }

  if (tiles.length === 0) {
    return fallback
  }
  return tiles
}


