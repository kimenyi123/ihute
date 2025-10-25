"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Supplier = { id: string; name: string; location?: string }

export function BusinessList({
  categoryId,
  selectedSupplier = "all",
  onSelect = () => {},
}: {
  categoryId: string
  selectedSupplier?: string
  onSelect?: (id: string, name: string) => void
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trackRef = useRef<HTMLDivElement | null>(null)

  function getApiBase() {
    if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE
    if (typeof window !== "undefined") return window.location.origin
    return ""
  }

  useEffect(() => {
    let isMounted = true
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const base = getApiBase()
        const url = `${base}/api/fetchSuggestions?listSuppliersBySector=${encodeURIComponent(categoryId)}`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Array<any>
        if (!isMounted) return
        const mapped: Supplier[] = (data || []).map((d) => ({
          id: String(d.id ?? d.SELLER_ISHYIGA_ACCOUNT ?? ""),
          name: String(d.name ?? d.SELLER_NAMES ?? "Supplier"),
          location: d.location ?? d.LOCATION ?? undefined,
        }))
        setSuppliers(mapped)
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Failed to load suppliers")
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    if (categoryId) run()
    return () => {
      isMounted = false
    }
  }, [categoryId])

  const scrollByAmount = (dir: "left" | "right") => {
    const el = trackRef.current
    if (!el) return
    const amount = Math.max(280, el.clientWidth * 0.75) // responsive feel
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" })
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Businesses in this category</h2>
        <p className="text-sm text-muted-foreground">
          Pick a business to see their products — or view all.
        </p>
      </div>

      <div className="relative">
        {/* left arrow */}
        <button
          aria-label="Scroll suppliers left"
          onClick={() => scrollByAmount("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 backdrop-blur hover:bg-accent shadow-sm hidden md:inline-flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* scroll track */}
        <div
          ref={trackRef}
          className={cn(
            // horizontal scroller; hide scrollbar; no wrap
            "flex items-center gap-2 overflow-x-auto whitespace-nowrap scroll-smooth px-10 md:px-12",
            "no-scrollbar"
          )}
          // keyboard support
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") scrollByAmount("left")
            if (e.key === "ArrowRight") scrollByAmount("right")
          }}
        >
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

          {loading && <span className="text-sm text-muted-foreground px-3">Loading…</span>}
          {error && <span className="text-sm text-destructive px-3">Failed: {error}</span>}

          {!loading &&
            !error &&
            suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id, s.name)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm flex-shrink-0",
                  selectedSupplier === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                )}
                title={s.location ? `${s.name} – ${s.location}` : s.name}
              >
                {s.name}
                {s.location ? ` – ${s.location}` : ""}
              </button>
            ))}
        </div>

        {/* right arrow */}
        <button
          aria-label="Scroll suppliers right"
          onClick={() => scrollByAmount("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border bg-background/90 backdrop-blur hover:bg-accent shadow-sm hidden md:inline-flex items-center justify-center"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* subtle gradient edges to hint scrollability */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  )
}
