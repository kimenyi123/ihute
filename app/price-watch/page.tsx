"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { DEFAULT_CURRENCY, DEFAULT_PLACEHOLDER_IMAGE } from "@/lib/constants"
import { EyeOff, Store, TrendingDown, TrendingUp, RefreshCw } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getProductImageUrl } from "@/lib/image-utils"

function extractNumericPrice(value: unknown): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Use shared resolution so images load consistently. */
function getWatchedItemImageUrl(w: { image_url?: string; image?: string; item_image_url?: string }): string | null {
  return getProductImageUrl(w)
}

function itemKey(productId: string, supplierId: string): string {
  return `${productId}|${supplierId}`
}

export default function PriceWatchPage() {
  const watched = usePriceWatchStore((s) => s.getWatched())
  const removeWatch = usePriceWatchStore((s) => s.removeWatch)
  const [fetchedImages, setFetchedImages] = useState<Record<string, string>>({})
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [priceFetchKey, setPriceFetchKey] = useState(0)

  const needImage = useMemo(
    () =>
      watched.filter(
        (w) => !getWatchedItemImageUrl(w) && w.name
      ),
    [watched]
  )

  useEffect(() => {
    if (needImage.length === 0) return
    let cancelled = false
    needImage.slice(0, 6).forEach((w) => {
      const k = itemKey(w.productId, w.supplierId)
      fetch(
        `/api/fetchSuggestions?globalSearch=${encodeURIComponent(w.productId || w.name)}&limit=3&Currency=RWF`
      )
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          const products = data?.products ?? []
          const match = products.find(
            (p: Record<string, unknown>) =>
              (String(p.item_code ?? p.item_key_words ?? p.ITEM_CODE ?? "").trim() === w.productId) ||
              (String(p.supplier_account ?? p.seller_account ?? "").trim() === w.supplierId)
          ) || products[0]
          const img = match ? getProductImageUrl(match as Record<string, unknown>) : null
          if (img && (img.startsWith("http") || img.startsWith("/"))) {
            setFetchedImages((prev) => ({ ...prev, [k]: img }))
          }
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [needImage])

  // Fetch current prices from backend so we can show price changes (supplier may have updated prices)
  const uniqueSupplierIds = useMemo(() => [...new Set(watched.map((w) => w.supplierId).filter(Boolean))], [watched])

  useEffect(() => {
    if (watched.length === 0 || uniqueSupplierIds.length === 0) return
    let cancelled = false
    setLoadingPrices(true)
    const next: Record<string, number> = {}
    const run = async () => {
      for (const supplierId of uniqueSupplierIds) {
        if (cancelled) return
        try {
          const res = await fetch(
            `/api/fetchSuggestions?supplierProducts=${encodeURIComponent(supplierId)}&limit=500&Currency=RWF`,
            { cache: "no-store" }
          )
          const raw = res.ok ? await res.json() : null
          const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.products) ? raw.products : []
          const supplierWatched = watched.filter((w) => w.supplierId === supplierId)
          for (const w of supplierWatched) {
            const match = list.find((p: Record<string, unknown>) => {
              const code = String(p.item_code ?? p.ITEM_CODE ?? p.item_key_words ?? "").trim()
              const name = String(p.item_commercial_name ?? p.ITEM_NAME ?? p.name ?? "").trim().toLowerCase()
              const wCode = (w.productId ?? "").trim()
              const wName = (w.name ?? "").trim().toLowerCase()
              return (wCode && code === wCode) || (wName && name && name.includes(wName) || wName.includes(name))
            })
            if (match) {
              const price = extractNumericPrice(match.selling_price ?? match.item_emballage ?? match.SALE_PRICE_INCLUSIVE ?? match.price)
              if (price > 0) next[itemKey(w.productId, w.supplierId)] = price
            }
          }
        } catch {
          // ignore per-supplier errors
        }
      }
      if (!cancelled) setCurrentPrices((prev) => ({ ...prev, ...next }))
    }
    run().finally(() => { if (!cancelled) setLoadingPrices(false) })
    return () => { cancelled = true }
  }, [watched.length, uniqueSupplierIds.join(","), priceFetchKey])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Your watched prices</h1>
            <p className="text-slate-600">
              Only you see this list. We&apos;ll notify you when a price drops below what it was when you added it.
            </p>
          </div>
          {watched.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPriceFetchKey((k) => k + 1)}
              disabled={loadingPrices}
              title="Reload current prices from the store"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingPrices ? "animate-spin" : ""}`} />
              Refresh prices
            </Button>
          )}
        </div>

        {watched.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <p>No items watched yet.</p>
              <p className="text-sm mt-1">Use &quot;Watch price&quot; on any product to get price-drop alerts.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/search">Search products</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {watched.map((w) => {
              const key = itemKey(w.productId, w.supplierId)
              const fromStore = getWatchedItemImageUrl(w)
              const fromFetch = fetchedImages[key]
              const imgSrc =
                fromFetch || fromStore || DEFAULT_PLACEHOLDER_IMAGE
              const current = currentPrices[key]
              const hasCurrent = typeof current === "number" && current > 0
              const dropped = hasCurrent && current < w.priceWhenWatched
              const increased = hasCurrent && current > w.priceWhenWatched
              const same = hasCurrent && current === w.priceWhenWatched
              return (
                <Card
                  key={`${w.productId}-${w.supplierId}`}
                  className="overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-square w-full bg-muted">
                    {imgSrc.startsWith("http") || imgSrc.startsWith("//") ? (
                      <img
                        src={imgSrc.startsWith("//") ? `https:${imgSrc}` : imgSrc}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Image
                        src={imgSrc}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized={imgSrc === DEFAULT_PLACEHOLDER_IMAGE}
                      />
                    )}
                  </div>
                  <CardContent className="p-3 flex flex-col flex-1">
                    <p className="font-medium text-slate-900 text-sm line-clamp-2 min-h-[2.5rem]">
                      {w.name}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Store className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {w.supplierName?.trim() || w.supplierId || "Seller"}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Watched at {w.priceWhenWatched.toLocaleString()} {DEFAULT_CURRENCY}
                    </p>
                    {loadingPrices && !hasCurrent ? (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Checking current price…
                      </p>
                    ) : hasCurrent ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                          Current: {current.toLocaleString()} {DEFAULT_CURRENCY}
                        </p>
                        {dropped && (
                          <Badge variant="outline" className="mt-1 w-fit bg-green-50 text-green-800 border-green-200">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Price dropped
                          </Badge>
                        )}
                        {increased && (
                          <Badge variant="outline" className="mt-1 w-fit bg-amber-50 text-amber-800 border-amber-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Price increased
                          </Badge>
                        )}
                        {same && (
                          <span className="text-xs text-slate-500 mt-1">No change</span>
                        )}
                      </>
                    ) : !loadingPrices ? (
                      <p className="text-xs text-slate-400 mt-0.5">Current price unavailable</p>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeWatch(w.productId, w.supplierId)}
                      title="Stop watching"
                      className="mt-3 w-full"
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
