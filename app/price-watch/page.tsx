"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { usePriceWatchStore } from "@/lib/price-watch-store"
import { useCartStore } from "@/lib/cart-store"
import { DEFAULT_CURRENCY, DEFAULT_PLACEHOLDER_IMAGE } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import { EyeOff, Store, TrendingDown, TrendingUp, RefreshCw, ChevronLeft, ChevronRight, ShoppingCart, Trash2, Download } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getProductImageUrl } from "@/lib/image-utils"
import { generalSellingPrice } from "@/lib/package-price"

function extractNumericPrice(value: unknown): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Simple Sparkline component showing price trend */
function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <div className="w-[60px] h-[20px]" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const trend = data[data.length - 1] - data[0];
  const color = trend < 0 ? '#22c55e' : trend > 0 ? '#ef4444' : '#64748b';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="3" fill={color} />
    </svg>
  );
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
  const updateWatch = usePriceWatchStore((s) => s.updateWatch)
  const autoRemoveAfterPurchase = usePriceWatchStore((s) => s.autoRemoveAfterPurchase)
  const setAutoRemoveAfterPurchase = usePriceWatchStore((s) => s.setAutoRemoveAfterPurchase)
  const addItem = useCartStore((s) => s.addItem)
  const { toast } = useToast()
  const [fetchedImages, setFetchedImages] = useState<Record<string, string>>({})
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [priceFetchKey, setPriceFetchKey] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12
  const mobileCarouselRef = useRef<HTMLDivElement>(null)

  // New features: Sort & Filter
  const [sortBy, setSortBy] = useState<'date' | 'priceChange' | 'currentPrice' | 'name'>('date')
  const [filterBy, setFilterBy] = useState<'all' | 'dropped' | 'increased' | 'unavailable'>('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Reset to page 1 when watched items count changes
  useEffect(() => {
    setCurrentPage(1)
  }, [watched.length])

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
              const base = extractNumericPrice(
                match.selling_price ?? match.SALE_PRICE_INCLUSIVE ?? match.price
              )
              const price = generalSellingPrice(
                base,
                match.item_emballage ?? match.ITEM_EMBALLAGE
              )
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

  // Price Drop Alerts - Show toast when prices drop
  useEffect(() => {
    if (loadingPrices || watched.length === 0) return

    const drops = watched.filter((w) => {
      const key = itemKey(w.productId, w.supplierId)
      const current = currentPrices[key]
      return current > 0 && current < w.priceWhenWatched
    })

    if (drops.length > 0) {
      // Show summary toast for multiple drops
      if (drops.length === 1) {
        const w = drops[0]
        const key = itemKey(w.productId, w.supplierId)
        const current = currentPrices[key]
        const savings = w.priceWhenWatched - current
        toast({
          title: "🎉 Price Drop Alert!",
          description: `${w.name} dropped by ${savings.toLocaleString()} ${DEFAULT_CURRENCY}!`,
          variant: "default",
        })
      } else {
        const totalSavings = drops.reduce((sum, w) => {
          const key = itemKey(w.productId, w.supplierId)
          const current = currentPrices[key]
          return sum + (w.priceWhenWatched - current)
        }, 0)
        toast({
          title: `🎉 ${drops.length} Prices Dropped!`,
          description: `You could save ${totalSavings.toLocaleString()} ${DEFAULT_CURRENCY} total!`,
          variant: "default",
        })
      }
    }
  }, [currentPrices, loadingPrices])

  // Calculate analytics
  const analytics = useMemo(() => {
    let totalWatched = 0
    let totalCurrent = 0
    let droppedCount = 0
    let increasedCount = 0
    let potentialSavings = 0

    watched.forEach((w) => {
      const key = itemKey(w.productId, w.supplierId)
      const current = currentPrices[key]
      totalWatched += w.priceWhenWatched
      if (current > 0) {
        totalCurrent += current
        if (current < w.priceWhenWatched) {
          droppedCount++
          // Only add to savings if price actually dropped
          potentialSavings += (w.priceWhenWatched - current)
        }
        if (current > w.priceWhenWatched) increasedCount++
      }
    })

    return {
      totalWatched,
      totalCurrent,
      potentialSavings,
      droppedCount,
      increasedCount,
      totalItems: watched.length
    }
  }, [watched, currentPrices])

  // Sort and filter items
  const processedItems = useMemo(() => {
    let items = [...watched]

    // Apply filter
    if (filterBy !== 'all') {
      items = items.filter((w) => {
        const key = itemKey(w.productId, w.supplierId)
        const current = currentPrices[key]
        const hasCurrent = current > 0
        const dropped = hasCurrent && current < w.priceWhenWatched
        const increased = hasCurrent && current > w.priceWhenWatched

        switch (filterBy) {
          case 'dropped': return dropped
          case 'increased': return increased
          case 'unavailable': return !hasCurrent && !loadingPrices
          default: return true
        }
      })
    }

    // Apply sort
    items.sort((a, b) => {
      const keyA = itemKey(a.productId, a.supplierId)
      const keyB = itemKey(b.productId, b.supplierId)
      const currentA = currentPrices[keyA] || 0
      const currentB = currentPrices[keyB] || 0

      switch (sortBy) {
        case 'date':
          return b.addedAt - a.addedAt
        case 'priceChange':
          const changeA = currentA ? ((currentA - a.priceWhenWatched) / a.priceWhenWatched) : 0
          const changeB = currentB ? ((currentB - b.priceWhenWatched) / b.priceWhenWatched) : 0
          return changeA - changeB
        case 'currentPrice':
          return (currentB || b.priceWhenWatched) - (currentA || a.priceWhenWatched)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return items
  }, [watched, currentPrices, sortBy, filterBy, loadingPrices])

  // Bulk selection toggle
  const toggleItemSelection = (productId: string, supplierId: string) => {
    const key = `${productId}|${supplierId}`
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Bulk remove
  const bulkRemove = () => {
    selectedItems.forEach((key) => {
      const [productId, supplierId] = key.split('|')
      removeWatch(productId, supplierId)
    })
    setSelectedItems(new Set())
    setShowBulkActions(false)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Product Name', 'Supplier', 'Watched Price', 'Current Price', 'Price Change', 'Currency']
    const rows = processedItems.map((w) => {
      const key = itemKey(w.productId, w.supplierId)
      const current = currentPrices[key]
      const change = current ? current - w.priceWhenWatched : 0
      return [
        w.name,
        w.supplierName || w.supplierId,
        w.priceWhenWatched,
        current || 'N/A',
        change || 'N/A',
        DEFAULT_CURRENCY
      ]
    })

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `price-watch-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPriceFetchKey((k) => k + 1)}
                disabled={loadingPrices}
                title="Reload current prices from the store"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingPrices ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                title="Export to CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          )}
        </div>

        {/* Analytics Summary */}
        {watched.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.totalItems}</p>
                <p className="text-xs text-slate-600">Items Watched</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.droppedCount}</p>
                <p className="text-xs text-slate-600">Prices Dropped</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{analytics.increasedCount}</p>
                <p className="text-xs text-slate-600">Prices Increased</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {analytics.potentialSavings > 0 ? analytics.potentialSavings.toLocaleString() : 0} {DEFAULT_CURRENCY}
                </p>
                <p className="text-xs text-slate-600">Potential Savings</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings: Auto-Remove Toggle */}
        {watched.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-100 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRemoveAfterPurchase}
                onChange={(e) => setAutoRemoveAfterPurchase(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">
                Auto-remove items from watch list after adding to cart
              </span>
            </label>
          </div>
        )}

        {/* Sort, Filter, and Bulk Actions */}
        {watched.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="date">Sort: Date Added</option>
                <option value="priceChange">Sort: Price Change</option>
                <option value="currentPrice">Sort: Current Price</option>
                <option value="name">Sort: Name</option>
              </select>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="all">Filter: All</option>
                <option value="dropped">Filter: Dropped</option>
                <option value="increased">Filter: Increased</option>
                <option value="unavailable">Filter: Unavailable</option>
              </select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkActions(!showBulkActions)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {showBulkActions ? 'Cancel' : 'Bulk Remove'}
              </Button>
              {showBulkActions && selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={bulkRemove}
                >
                  Remove {selectedItems.size}
                </Button>
              )}
            </div>
          </div>
        )}

        {processedItems.length === 0 ? (
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
          <>
          {/* Mobile: Horizontal swipe carousel | Desktop: Grid */}
          <div className="sm:hidden relative">
            {/* Top swipe hint - subtle with clickable arrows */}
            <div className="flex items-center justify-center gap-2 mb-2 text-slate-400 text-xs select-none">
              <button
                onClick={() => mobileCarouselRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Swipe or tap arrows</span>
              <button
                onClick={() => mobileCarouselRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Gradient fade indicating more content */}
            <div className="absolute right-0 top-6 bottom-12 w-16 bg-gradient-to-l from-slate-200 via-slate-100 to-transparent pointer-events-none z-10"></div>

            <div ref={mobileCarouselRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide">
              {processedItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((w) => {
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
                  className="overflow-hidden flex-shrink-0 w-[260px] snap-start flex flex-col relative"
                >
                  {/* Bulk selection checkbox */}
                  {showBulkActions && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(`${w.productId}|${w.supplierId}`)}
                        onChange={() => toggleItemSelection(w.productId, w.supplierId)}
                        className="h-5 w-5 rounded border-slate-300"
                      />
                    </div>
                  )}
                  <div className="relative aspect-square w-full bg-muted flex-shrink-0">
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
                    <p className="font-medium text-slate-900 text-sm line-clamp-2">
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
                        {/* Target Hit Badge - only show if price actually dropped to target or below */}
                        {w.targetPrice && current <= w.targetPrice && current < w.priceWhenWatched && (
                          <Badge className="mt-1 w-fit bg-purple-100 text-purple-800 border-purple-300 animate-pulse">
                            🎯 Price Dropped to Target!
                          </Badge>
                        )}
                      </>
                    ) : !loadingPrices ? (
                      <p className="text-xs text-slate-400 mt-0.5">Current price unavailable</p>
                    ) : null}
                    {/* Target Price Input */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Alert at:</span>
                      <input
                        type="number"
                        placeholder={`e.g. ${Math.floor(w.priceWhenWatched * 0.9)}`}
                        value={w.targetPrice || ''}
                        onChange={(e) => updateWatch(w.productId, w.supplierId, { targetPrice: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-20 px-2 py-1 text-xs border rounded"
                        title="Alert when price drops to this amount or lower"
                      />
                      <span className="text-xs text-slate-500">{DEFAULT_CURRENCY}</span>
                    </div>
                    <div className="flex-1"></div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          addItem({
                            id: w.productId,
                            name: w.name,
                            price: current > 0 ? current : w.priceWhenWatched,
                            supplierId: w.supplierId,
                            supplierName: w.supplierName || w.supplierId,
                            image: imgSrc,
                          }, 1)
                          toast({
                            title: "Added to cart",
                            description: `${w.name} added to your cart`,
                          })
                          // Auto-remove if enabled
                          if (w.autoRemoveAfterPurchase || autoRemoveAfterPurchase) {
                            removeWatch(w.productId, w.supplierId)
                          }
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Add to Cart
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeWatch(w.productId, w.supplierId)}
                        title="Stop watching"
                        className="flex-1"
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            </div>
          </div>

          {/* Desktop: Grid Layout */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {processedItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((w) => {
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
                  key={`${w.productId}-${w.supplierId}-desktop`}
                  className="overflow-hidden flex flex-col h-full relative"
                >
                  {/* Bulk selection checkbox */}
                  {showBulkActions && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(`${w.productId}|${w.supplierId}`)}
                        onChange={() => toggleItemSelection(w.productId, w.supplierId)}
                        className="h-5 w-5 rounded border-slate-300"
                      />
                    </div>
                  )}
                  <div className="relative aspect-square w-full bg-muted flex-shrink-0">
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
                    <p className="font-medium text-slate-900 text-sm line-clamp-2">
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
                        {/* Target Hit Badge - only show if price actually dropped to target or below */}
                        {w.targetPrice && current <= w.targetPrice && current < w.priceWhenWatched && (
                          <Badge className="mt-1 w-fit bg-purple-100 text-purple-800 border-purple-300 animate-pulse">
                            🎯 Price Dropped to Target!
                          </Badge>
                        )}
                      </>
                    ) : !loadingPrices ? (
                      <p className="text-xs text-slate-400 mt-0.5">Current price unavailable</p>
                    ) : null}
                    {/* Target Price Input */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Alert at:</span>
                      <input
                        type="number"
                        placeholder={`e.g. ${Math.floor(w.priceWhenWatched * 0.9)}`}
                        value={w.targetPrice || ''}
                        onChange={(e) => updateWatch(w.productId, w.supplierId, { targetPrice: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-20 px-2 py-1 text-xs border rounded"
                        title="Alert when price drops to this amount or lower"
                      />
                      <span className="text-xs text-slate-500">{DEFAULT_CURRENCY}</span>
                    </div>
                    <div className="flex-1"></div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          addItem({
                            id: w.productId,
                            name: w.name,
                            price: current > 0 ? current : w.priceWhenWatched,
                            supplierId: w.supplierId,
                            supplierName: w.supplierName || w.supplierId,
                            image: imgSrc,
                          }, 1)
                          toast({
                            title: "Added to cart",
                            description: `${w.name} added to your cart`,
                          })
                          // Auto-remove if enabled
                          if (w.autoRemoveAfterPurchase || autoRemoveAfterPurchase) {
                            removeWatch(w.productId, w.supplierId)
                          }
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Add to Cart
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeWatch(w.productId, w.supplierId)}
                        title="Stop watching"
                        className="flex-1"
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {processedItems.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(processedItems.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                  .filter((page) => {
                    const total = Math.ceil(processedItems.length / ITEMS_PER_PAGE)
                    // Show first page, last page, current page and neighbors
                    return page === 1 || page === total || Math.abs(page - currentPage) <= 1
                  })
                  .map((page, idx, arr) => (
                    <div key={page} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className="min-w-[40px]"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </div>
                  ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(processedItems.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage === Math.ceil(processedItems.length / ITEMS_PER_PAGE)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Mobile: Swipe hint - bottom with clickable arrows */}
          <div className="sm:hidden flex items-center justify-center gap-2 mt-4 bg-blue-50 rounded-full px-4 py-2 mx-auto w-fit select-none">
            <button
              onClick={() => mobileCarouselRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
              className="p-1 hover:bg-blue-100 rounded-full transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5 text-blue-600 animate-bounce" />
            </button>
            <span className="text-sm font-semibold text-blue-700">Swipe or tap</span>
            <button
              onClick={() => mobileCarouselRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
              className="p-1 hover:bg-blue-100 rounded-full transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5 text-blue-600 animate-bounce" />
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, processedItems.length)} - {Math.min(currentPage * ITEMS_PER_PAGE, processedItems.length)} of {processedItems.length} items
            {filterBy !== 'all' && ` (filtered from ${watched.length} total)`}
          </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
