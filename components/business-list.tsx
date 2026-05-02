"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

type Supplier = { id: string; name: string; location?: string }

type RawSupplierRow = Record<string, unknown>

function extractSuppliersArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>
    if (Array.isArray(o.sellers)) return o.sellers
    if (Array.isArray(o.suppliers)) return o.suppliers
    if (Array.isArray(o.data)) return o.data
    if (Array.isArray(o.results)) return o.results
  }
  return []
}

function mapRowsToSuppliers(rows: unknown[], categoryId: string): Supplier[] {
  return rows.map((row, index) => {
    const d = row as RawSupplierRow
    const rawId = d.id ?? d.SELLER_ISHYIGA_ACCOUNT
    const id =
      rawId != null && String(rawId).trim() !== ""
        ? String(rawId)
        : `__row_${categoryId}_${index}`
    return {
      id,
      name: String(d.name ?? d.SELLER_NAMES ?? "Supplier"),
      location:
        typeof d.location === "string"
          ? d.location
          : typeof d.LOCATION === "string"
            ? d.LOCATION
            : undefined,
    }
  })
}

const SKELETON_CHIPS = 6

export function BusinessList({
  categoryId,
  selectedSupplier = "all",
  onSelect = () => {},
  hideHeader = false,
  shopSelectionOnly = false,
}: {
  categoryId: string
  selectedSupplier?: string
  onSelect?: (id: string, name: string) => void
  /** When true, only the horizontal shop pills are shown (parent supplies context). */
  hideHeader?: boolean
  /** Hide “All suppliers”; user must pick one shop (Browse by shop). */
  shopSelectionOnly?: boolean
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const headingId = "business-list-heading"
  const statusId = "business-list-status"

  useEffect(() => {
    let isMounted = true
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const url = `/api/fetchSuggestions?listSuppliersBySector=${encodeURIComponent(categoryId)}`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const raw: unknown = await res.json()
        const data = extractSuppliersArray(raw)
        if (!isMounted) return
        setSuppliers(mapRowsToSuppliers(data, categoryId))
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to load suppliers"
        if (isMounted) setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    if (categoryId) run()
    return () => {
      isMounted = false
    }
  }, [categoryId, reloadNonce])

  const scrollByAmount = (dir: "left" | "right") => {
    const el = trackRef.current
    if (!el) return
    const amount = Math.max(280, el.clientWidth * 0.75)
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" })
  }

  const scrollToEdge = (edge: "start" | "end") => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({
      left: edge === "start" ? 0 : el.scrollWidth,
      behavior: "smooth",
    })
  }

  const retry = () => setReloadNonce((n) => n + 1)

  const showEmpty = !loading && !error && suppliers.length === 0

  return (
    <div>
      {!hideHeader && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Businesses in this category</h2>
          <p className="text-sm text-muted-foreground">
            Pick a business to see their products — or view all.
          </p>
        </div>
      )}
    <section aria-labelledby={headingId}>
      <div className="mb-4">
        <h2 id={headingId} className="text-xl font-semibold">
          Businesses in this category
        </h2>
        <p id={`${headingId}-desc`} className="text-sm text-muted-foreground">
          Pick a business to see their products — or view all.
        </p>
      </div>

      <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? "Loading businesses."
          : error
            ? `Failed to load businesses: ${error}`
            : showEmpty
              ? "No businesses listed in this category."
              : ""}
      </p>

      <div className="relative">
        <button
          type="button"
          aria-label="Scroll suppliers left"
          onClick={() => scrollByAmount("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 backdrop-blur hover:bg-accent shadow-sm hidden md:inline-flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        <div
          ref={trackRef}
          role="group"
          aria-label="Filter products by supplier"
          aria-busy={loading}
          aria-describedby={`${headingId}-desc`}
          className={cn(
            "flex items-center gap-2 overflow-x-auto whitespace-nowrap scroll-smooth px-10 md:px-12 min-h-[2.75rem]",
            "no-scrollbar"
          )}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              scrollByAmount("left")
              e.preventDefault()
            }
            if (e.key === "ArrowRight") {
              scrollByAmount("right")
              e.preventDefault()
            }
            if (e.key === "Home") {
              scrollToEdge("start")
              e.preventDefault()
            }
            if (e.key === "End") {
              scrollToEdge("end")
              e.preventDefault()
            }
          }}
        >
          {!shopSelectionOnly && (
            <button
              onClick={() => onSelect("all", "All Suppliers")}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm flex-shrink-0",
                selectedSupplier === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              )}
            >
              All Suppliers
            </button>
          )}

          {loading &&
            Array.from({ length: SKELETON_CHIPS }, (_, i) => (
              <div
                key={`sk-${i}`}
                className="h-9 w-28 flex-shrink-0 rounded-full bg-muted animate-pulse"
                aria-hidden
              />
            ))}

          {error && (
            <div
              className="flex items-center gap-2 px-2 py-1 flex-wrap"
              role="alert"
            >
              <span className="text-sm text-destructive">{error}</span>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Retry
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            suppliers.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                type="button"
                onClick={() => onSelect(s.id, s.name)}
                aria-pressed={selectedSupplier === s.id}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm flex-shrink-0 max-w-[min(100vw-4rem,20rem)] truncate",
                  selectedSupplier === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                )}
                title={s.location ? `${s.name} – ${s.location}` : s.name}
              >
                <span className="truncate">
                  {s.name}
                  {s.location ? ` – ${s.location}` : ""}
                </span>
              </button>
            ))}

          {showEmpty && (
            <p className="text-sm text-muted-foreground px-2 py-1 max-w-md">
              No businesses are listed in this category yet. Use{" "}
              <span className="font-medium text-foreground">All Suppliers</span>{" "}
              to browse products from every seller.
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label="Scroll suppliers right"
          onClick={() => scrollByAmount("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 backdrop-blur hover:bg-accent shadow-sm hidden md:inline-flex items-center justify-center"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>

        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
    </div>
  )
}
