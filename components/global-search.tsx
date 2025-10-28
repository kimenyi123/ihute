// components/global-search.tsx
"use client"

import { useEffect, useRef, useState, KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { usePrefsStore } from "@/lib/prefs-store"
import { useCartStore } from "@/lib/cart-store"

type GlobalResult = {
  type?: "product" | "supplier"
  item_code?: string
  item_commercial_name?: string
  item_packet?: string
  item_emballage?: string
  item_key_words?: string
  item_seller_account?: string
  supplier_account?: string
  supplier_name?: string
  supplier_location?: string
  momo?: string
  match_type?: "product" | "supplier"
  image?: string
}

type GlobalSearchResponse = {
  suppliersByName: GlobalResult[]
  suppliersByProduct: GlobalResult[]
  products: GlobalResult[]
  query: string
  timestamp?: number
  error?: string
}

function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value
  const n = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const parsed = parseFloat(n)
  return Number.isFinite(parsed) ? parsed : 0
}

export function GlobalSearch({
  placeholder = "Search for products or suppliers... (e.g., 'FANTA' or 'Shop Name')",
  className,
  maxSuggestions = 12,
}: {
  placeholder?: string
  className?: string
  maxSuggestions?: number
}) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [products, setProducts] = useState<GlobalResult[]>([])
  const [suppliers, setSuppliers] = useState<GlobalResult[]>([])
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const sector = usePrefsStore((s) => s.sector)
  const location = usePrefsStore((s) => s.location)

  const addToCartFn = useCartStore((s: any) => s.addOrInc ?? s.add)

  // Mount detection for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  const addProductAndGoToCart = (p: GlobalResult) => {
    if (!addToCartFn) return
    const id =
      p.item_code ||
      `${(p.item_commercial_name || "product").toLowerCase()}-${p.item_packet || ""}`
    const unit = p.item_packet || ""
    const price = extractNumericPrice(p.item_emballage)

    addToCartFn({
      id,
      name: p.item_commercial_name,
      price,
      unit,
      selectedUnit: unit,
      qty: 1,
      supplierId: p.supplier_account || p.item_seller_account,
      supplierName: p.supplier_name || p.supplier_account || "Supplier",
      supplierLocation: p.supplier_location,
      image: p.image || "/placeholder.svg?height=300&width=300",
    })
    router.push("/cart")
    setOpen(false)
    setQ("")
  }

  useEffect(() => {
    if (!q.trim()) {
      setProducts([])
      setSuppliers([])
      setOpen(false)
      return
    }
    const id = setTimeout(async () => {
      setLoading(true)
      setErr(null)
      try {
        const params = new URLSearchParams({
          globalSearch: q,
          limit: String(maxSuggestions),
          Currency: "RWF",
          ...(sector ? { sector } : {}),
          ...(location ? { location } : {}),
        }).toString()

        // const res = await fetch(`/api/fetchSuggestions?${params}`, { cache: "no-store" })
        const res = await fetch(`Trading/Kaos/fetchSuggestions?${params}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Search failed: ${res.status}`)
        const json: GlobalSearchResponse = await res.json()

        const p = (json.products || []).slice(0, Math.max(6, Math.floor(maxSuggestions * 0.66)))
        const s = [...(json.suppliersByName || []), ...(json.suppliersByProduct || [])]
          .slice(0, Math.max(6, Math.floor(maxSuggestions * 0.34)))

        setProducts(p)
        setSuppliers(s)
        setOpen(true)
      } catch (e: any) {
        console.error("Search error:", e)
        setErr(e?.message || "Search failed")
        setProducts([])
        setSuppliers([])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [q, maxSuggestions, sector, location])

  // Click outside detection - now includes portal dropdown
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (
        !wrapRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const onSubmit = (value: string) => {
    const term = value.trim()
    if (!term) return
    setOpen(false)
    setQ("")
    const sp = new URLSearchParams({
      q: term,
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    }).toString()
    router.push(`/search?${sp}`)
  }

  const onSubmitSupplier = (s: GlobalResult) => {
    const supplierAccount = s.supplier_account || s.item_seller_account
    const supplierName = s.supplier_name || supplierAccount || ""
    const params = new URLSearchParams({
      ...(supplierName ? { q: supplierName } : {}),
      supplier: supplierAccount || "",
      ...(supplierName ? { supplierName } : {}),
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })
    setOpen(false)
    setQ("")
    router.push(`/search?${params.toString()}`)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onSubmit(q)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  // Get input position for dropdown placement
  const getDropdownPosition = () => {
    if (!inputRef.current) return { top: 0, left: 0, width: 0 }
    const rect = inputRef.current.getBoundingClientRect()
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    }
  }

  const dropdownPos = getDropdownPosition()

  return (
    <>
      <div ref={wrapRef} className={cn("relative w-full", className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          className="pl-10 pr-3 h-9"
        />
      </div>

      {/* Portal-rendered dropdown */}
      {mounted &&
        open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 rounded-md border bg-popover text-popover-foreground shadow-lg"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxWidth: "90vw",
              maxHeight: "60vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>}
            {err && !loading && <div className="px-3 py-2 text-sm text-destructive">{err}</div>}

            {!loading && !err && (products.length > 0 || suppliers.length > 0) && (
              <div className="p-3 space-y-3">
                {/* Products */}
                {products.length > 0 && (
                  <section>
                    <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Products
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {products.map((p, i) => (
                        <button
                          key={`p-${p.item_code || p.item_commercial_name}-${i}`}
                          className="w-full text-left rounded-lg border p-3 hover:border-blue-300 hover:bg-accent transition-colors group"
                          onClick={() => addProductAndGoToCart(p)}
                          title="Click to add & go to cart"
                        >
                          <div className="font-medium text-gray-900 group-hover:text-blue-700">
                            {p.item_commercial_name}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">{p.item_packet || ""}</div>
                          <div className="mt-1 text-sm font-semibold text-green-600">
                            {p.item_emballage || "Price not available"}
                          </div>
                          {p.supplier_name && (
                            <div className="mt-1 text-[11px] text-gray-500">
                              Sold by: {p.supplier_name}
                              {p.supplier_location && ` • ${p.supplier_location}`}
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Add & go to cart →
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Suppliers */}
                {suppliers.length > 0 && (
                  <section>
                    <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Suppliers
                    </div>
                    <div className="space-y-1">
                      {suppliers.map((s, i) => (
                        <button
                          key={`s-${s.supplier_account || s.supplier_name}-${i}`}
                          className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-accent transition-colors"
                          onClick={() => onSubmitSupplier(s)}
                          title="Open this supplier in search (preselected)"
                        >
                          <div className="flex-1">
                            <div className="font-medium leading-tight flex items-center gap-2">
                              {s.supplier_name || s.supplier_account || "Supplier"}
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded",
                                  s.match_type === "product"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                )}
                              >
                                {s.match_type === "product" ? "Has Products" : "Supplier"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {(s.supplier_location || "No location") +
                                (s.match_type === "product" ? " • Product match" : " • Name match")}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {!loading && !err && products.length === 0 && suppliers.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}