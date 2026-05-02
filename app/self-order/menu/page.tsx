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

  const nickname = useMemo(() => {
    const explicit = searchParams.get("nickname")
    if (explicit && explicit.trim()) return explicit.trim().toLowerCase()

    const entries = Array.from(searchParams.entries())
    if (entries.length === 1) {
      const [key, value] = entries[0]
      const normalizedKey = key.trim().toLowerCase()
      if (normalizedKey === "kioskcategory") return ""

      const raw = (value && value.trim()) || key
      if (raw) return raw.trim().toLowerCase()
    }

    return ""
  }, [searchParams])

  const kioskCategory =
    (searchParams.get("kioskCategory") as KioskCategory | null) ?? "BAR"

  const hasOrderType = !!tableInfo?.orderType

  const [gatePhase, setGatePhase] = useState<"type" | "details">("type")
  const [draftOrderType, setDraftOrderType] = useState<"dine-in" | "takeaway" | null>(null)
  const [guestName, setGuestName] = useState("")
  const [guestTable, setGuestTable] = useState("")

  useEffect(() => {
    const load = async () => {
      setItems(null)
      setError(null)
      try {
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
          const sellerName =
            seller.OWNER || seller.SELLER_NAMES || seller.NICKNAME || "Bar & Restaurant"
          setVenueTitle(sellerName)

          const products = Array.isArray(seller.products) ? seller.products : []

          const mapped: KioskMenuItem[] = products.map((p: Record<string, unknown>) => ({
            item_code: String(p.ITEM_CODE ?? ""),
            item_commercial_name: String(p.item_commercial_name ?? "Product"),
            item_name: p.item_name,
            selling_price: Number(p.selling_price ?? 0),
            unit: String(p.unit ?? "pcs"),
            image_url: p.image_url,
            supplier_account: "",
            supplier_name: sellerName,
            category: String(p.famille ?? ""),
          }))

          setItems(mapped)
          return
        }

        const res = await fetch(
          `/api/kiosk/menu?category=${encodeURIComponent(kioskCategory)}`
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
      <div className="min-h-screen bg-[#ffffff] text-[#000000] flex flex-col items-center justify-center px-4">
        <p className="text-sm text-green-600 mb-4">{error}</p>
        <button
          type="button"
          className="text-sm underline text-green-600"
          onClick={() => router.push("/self-order")}
        >
          Back
        </button>
      </div>
    )
  }

  if (!items) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center text-[#000000]">
        Loading menu…
      </div>
    )
  }

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
        <div className="min-h-screen bg-[#ffffff] flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full space-y-6 bg-[#ffffff] rounded-2xl border border-green-200 shadow-sm p-6">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-[#000000]">Almost there</h1>
              <p className="text-sm text-[#000000]">
                Who is this order for?
              </p>
            </div>

            <div className="space-y-4">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
              />
              <Input
                value={guestTable}
                onChange={(e) => setGuestTable(e.target.value)}
                placeholder="Table"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-green-500 text-green-600"
                onClick={() => {
                  setGatePhase("type")
                  setDraftOrderType(null)
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={finishGate}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-[#000000]">
            Welcome to {displayName}
          </h1>

          <div className="flex gap-6 justify-center">
            <button
              onClick={() => {
                setDraftOrderType("dine-in")
                setGatePhase("details")
              }}
              className="px-6 py-4 border border-green-500 rounded-xl bg-green-600 text-white"
            >
              Dine In
            </button>

            <button
              onClick={() => {
                setDraftOrderType("takeaway")
                setGatePhase("details")
              }}
              className="px-6 py-4 border border-green-300 rounded-xl bg-green-500 text-white"
            >
              Take Away
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