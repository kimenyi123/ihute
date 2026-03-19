"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { KioskCategory, KioskMenuItem } from "@/src/modules/self-order/types"
import { KioskMenuGrid } from "@/src/modules/self-order/components/KioskMenuGrid"
import { useCartStore } from "@/lib/cart-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SelfOrderMenuPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [items, setItems] = useState<KioskMenuItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [venueTitle, setVenueTitle] = useState<string | undefined>(undefined)

  const tableInfo = useCartStore((s) => s.tableInfo)
  const setTableInfo = useCartStore((s) => s.setTableInfo)

  // If a nickname is present (or a bare ?BURROWS style query), treat this page as
  // "shop-with-me" style: load products for that shop instead of kiosk category.
  const nickname = useMemo(() => {
    const explicit = searchParams.get("nickname")
    if (explicit && explicit.trim()) return explicit.trim().toLowerCase()

    const entries = Array.from(searchParams.entries())
    if (entries.length === 1) {
      const [key, value] = entries[0]
      // Support /self-order/menu?BURROWS or /self-order/menu?BURROWS=1
      const normalizedKey = key.trim().toLowerCase()
      // Don't treat kioskCategory as nickname.
      if (normalizedKey === "kioskcategory") return ""

      const raw = (value && value.trim()) || key
      if (raw) return raw.trim().toLowerCase()
    }

    return ""
  }, [searchParams])

  const kioskCategory =
    (searchParams.get("kioskCategory") as KioskCategory | null) ?? "BAR"

  const hasOrderType = !!tableInfo?.orderType

  /** After choosing dine-in / takeaway, collect name + table before opening the menu */
  const [gatePhase, setGatePhase] = useState<"type" | "details">("type")
  const [draftOrderType, setDraftOrderType] = useState<"dine-in" | "takeaway" | null>(null)
  const [guestName, setGuestName] = useState("")
  const [guestTable, setGuestTable] = useState("")

  useEffect(() => {
    const load = async () => {
      setItems(null)
      setError(null)
      try {
        // Shop-with-me style: load one seller's full stock by nickname
        if (nickname) {
          const params = new URLSearchParams({ nickname })
          const res = await fetch(`/api/shop-with-me?${params.toString()}`, {
            cache: "no-store",
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.ok || !Array.isArray(data.sellers) || data.sellers.length === 0) {
            setError(data.error || "Failed to load shop")
            setItems([])
            return
          }

          const seller = data.sellers[0]
          const sellerName: string =
            seller.OWNER || seller.SELLER_NAMES || seller.NICKNAME || "Bar & Restaurant"
          setVenueTitle(sellerName)
          const products: any[] = Array.isArray(seller.products) ? seller.products : []

          const mapped: KioskMenuItem[] = products.map((p) => ({
            item_code: String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? ""),
            item_commercial_name: String(
              p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "Product",
            ),
            item_name: p.item_name ?? p.ITEM_NAME,
            selling_price: Number(
              p.selling_price ?? p.price ?? p.SALE_PRICE_INCLUSIVE ?? 0,
            ),
            unit: String(p.unit ?? p.UNIT ?? "pcs"),
            image_url: p.image_url ?? p.item_image_url ?? p.image,
            supplier_account: String(
              seller.ISHYIGA_ACCOUNT ?? seller.seller_account ?? ""),
            supplier_name: String(
              seller.OWNER ?? seller.SELLER_NAMES ?? seller.NICKNAME ?? ""),
            supplier_location: seller.LOCATION,
            momo: seller.momo ?? seller.MOMO ?? undefined,
            // shop-with-me backend uses PHONE_NUMBER from account_signup.TEL
            sellerPhone:
              seller.PHONE_NUMBER ?? seller.TEL ?? seller.phone_number ?? undefined,
            search_priority: undefined,
            contains_ingredient: undefined,
            category: String(p.famille ?? p.FAMILLE ?? ""),
            sector: undefined,
            item_department: String(p.famille ?? p.FAMILLE ?? ""),
            keywords: p.item_key_words,
          }))

          setItems(mapped)
          return
        }

        // Default kiosk behaviour (category-based)
        const res = await fetch(
          `/api/kiosk/menu?category=${encodeURIComponent(kioskCategory)}`,
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error || "Failed to load menu")
          setItems([])
          return
        }
        setItems(Array.isArray(data.items) ? data.items : [])
        setVenueTitle(undefined)
      } catch (e: any) {
        setError(e?.message || "Failed to load menu")
        setItems([])
      }
    }
    load()
  }, [kioskCategory, nickname])

  if (error) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center px-4">
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button
          type="button"
          className="text-sm underline text-red-600"
          onClick={() => router.push("/self-order")}
        >
          Back to self‑order home
        </button>
      </div>
    )
  }

  if (!items) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-500">
        Loading menu…
      </div>
    )
  }

  // ─── Order type gate (Dine-in vs Take-away) + guest details ───────────────
  if (!hasOrderType) {
    const displayName =
      venueTitle ||
      (nickname ? nickname.replace(/%20/gi, " ").replace(/\s+/g, " ") : "our restaurant")

    const finishGate = () => {
      if (!draftOrderType) return
      const current = tableInfo || {}
      setTableInfo({
        ...current,
        orderType: draftOrderType,
        shopName: venueTitle || current.shopName,
        customerName: guestName.trim() || undefined,
        tableNumber: guestTable.trim() || undefined,
      })
    }

    if (gatePhase === "details" && draftOrderType) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-slate-900">Almost there</h1>
              <p className="text-sm text-slate-500">
                Who is this order for? (helps staff find you)
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Your name</label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Jean"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Table / spot {draftOrderType === "takeaway" ? "(optional)" : ""}
                </label>
                <Input
                  value={guestTable}
                  onChange={(e) => setGuestTable(e.target.value)}
                  placeholder={draftOrderType === "dine-in" ? "e.g. Table 5" : "Optional"}
                  className="bg-white"
                />
              </div>
              <p className="text-xs text-slate-400">
                Order type:{" "}
                <span className="font-semibold text-slate-600 capitalize">
                  {draftOrderType === "takeaway" ? "Take away" : "Dine in"}
                </span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setGatePhase("type")
                  setDraftOrderType(null)
                }}
              >
                Back
              </Button>
              <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700" onClick={finishGate}>
                Continue to menu
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-3xl w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Welcome to {displayName}
            </h1>
            <p className="text-slate-600 text-sm md:text-base">
              How would you like your order?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => {
                setDraftOrderType("dine-in")
                setGatePhase("details")
              }}
              className="group rounded-3xl border-2 border-red-500 bg-white px-6 py-8 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition"
            >
              <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center text-3xl text-white">
                🍽️
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">Dine In</p>
                <p className="text-sm text-slate-500">Enjoy your meal in our restaurant</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDraftOrderType("takeaway")
                setGatePhase("details")
              }}
              className="group rounded-3xl border-2 border-rose-100 bg-white px-6 py-8 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition"
            >
              <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center text-3xl text-red-600">
                🛍️
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">Take Away</p>
                <p className="text-sm text-slate-500">Grab your order and go</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <KioskMenuGrid
      items={items}
      category={kioskCategory}
      venueName={venueTitle}
      shopNickname={nickname || undefined}
    />
  )
}

