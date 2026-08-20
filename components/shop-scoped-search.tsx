"use client"

import { useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

type ShopScopedSearchProps = {
  value: string
  onChange: (value: string) => void
  shopName?: string
  placeholder?: string
  id?: string
  className?: string
  trailing?: React.ReactNode
  isSearching?: boolean
}

export function ShopScopedSearch({
  value,
  onChange,
  shopName,
  placeholder,
  id = "shop-scoped-search",
  className,
  trailing,
  isSearching,
}: ShopScopedSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const label = shopName ? `Search ${shopName}` : "Search this shop"
  const defaultPlaceholder =
    "Search by product name or keyword (any language)…"

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 border-blue-400/70 bg-gradient-to-b from-blue-50 via-white to-white shadow-lg ring-2 ring-blue-100",
        className,
      )}
    >
      <div className="flex items-center border-b border-blue-200/60 bg-blue-600/10 px-3 py-2 sm:px-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-900 sm:text-sm">{label}</p>
      </div>
      <div className="p-2 sm:p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600"
            aria-hidden
          />
          <input
            ref={inputRef}
            id={id}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? defaultPlaceholder}
            className="w-full rounded-lg border-2 border-blue-300 bg-white py-3 pl-11 pr-14 text-base font-medium text-foreground shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            aria-label={shopName ? `Search products in ${shopName}` : "Search products in this shop"}
          />
          {isSearching ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600 animate-pulse">
              …
            </span>
          ) : !value ? (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-1.5 font-mono text-[10px] font-medium text-blue-700 sm:inline-flex shadow-xs">
              <span className="text-xs">⌘</span>K
            </kbd>
          ) : null}
        </div>
        {trailing ? <div className="mt-2 flex flex-wrap items-center gap-2">{trailing}</div> : null}
      </div>
    </div>
  )
}
