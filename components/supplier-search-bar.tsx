"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Building2, Loader2, MapPin, Package, Languages } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { usePrefsStore } from "@/lib/prefs-store"
import { filterSuppliersByRelevance } from "@/lib/search-utils"
import { getTranslations } from "@/lib/keyword-mapping"

type Supplier = {
  supplier_account: string
  supplier_name: string
  supplier_location?: string
  productCount?: number
}

type SearchResponse = {
  suppliersByName?: Supplier[]
  suppliersByProduct?: Supplier[]
  error?: string
}

export function SupplierSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Supplier[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeQuickSearch, setActiveQuickSearch] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const sector = usePrefsStore((s) => s.sector)
  const location = usePrefsStore((s) => s.location)
  const setSector = usePrefsStore((s) => s.setSector)

  // Get translations for current query
  const translations = query.trim() ? getTranslations(query.trim()) : null

  // Search as you type with debounce
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      setActiveQuickSearch(null)
      return
    }

    // Reset active quick search when user types manually
    setActiveQuickSearch(null)

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({
          globalSearch: query.trim(),
          limit: "10",
          Currency: "RWF",
          ...(sector ? { sector } : {}),
          ...(location ? { location } : {}),
        })

        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store"
        })

        if (!res.ok) throw new Error("Search failed")

        const json: SearchResponse = await res.json()

        // Combine suppliers from both name and product matches
        const suppliersByName = json.suppliersByName || []
        const suppliersByProduct = json.suppliersByProduct || []
        const allSuppliers = [...suppliersByName, ...suppliersByProduct]

        // Remove duplicates based on supplier_account
        const uniqueSuppliers = allSuppliers.filter((supplier, index, self) =>
          index === self.findIndex((s) => s.supplier_account === supplier.supplier_account)
        )

        // Apply relevance filtering - only show suppliers with high relevance scores
        // This filters out irrelevant results like "pharmacy" when searching for "fanta"
        const filteredSuppliers = filterSuppliersByRelevance(
          uniqueSuppliers,
          query.trim(),
          30 // Strict threshold - only word boundary matches or better to avoid unrelated results
        )

        setSuggestions(filteredSuppliers.slice(0, 8))
        setShowSuggestions(filteredSuppliers.length > 0)
      } catch (error) {
        console.error("Supplier search error:", error)
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [query, sector, location])

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setShowSuggestions(false)

    // Navigate to search page with supplier-specific search
    const searchParams = new URLSearchParams({
      q: query.trim(),
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })

    router.push(`/search?${searchParams.toString()}`)
  }

  const handleSupplierClick = (supplier: Supplier) => {
    setShowSuggestions(false)
    setQuery("")

    const searchParams = new URLSearchParams({
      q: supplier.supplier_name,
      supplier: supplier.supplier_account,
      supplierName: supplier.supplier_name,
      ...(sector ? { sector } : {}),
      ...(location ? { location } : {}),
    })

    router.push(`/search?${searchParams.toString()}`)
  }

  const handleQuickSearch = async (suggestion: string) => {
    setQuery(suggestion)
    setActiveQuickSearch(suggestion)
    setIsSearching(true)

    // Set the sector based on the quick search selection
    setSector(suggestion)

    try {
      // Fetch suppliers filtered by category/type
      const params = new URLSearchParams({
        globalSearch: suggestion,
        limit: "20",
        Currency: "RWF",
        sector: suggestion, // Use the quick search as sector filter
        ...(location ? { location } : {}),
      })

      const res = await fetch(`/api/fetchSuggestions?${params}`, {
        cache: "no-store"
      })

      if (!res.ok) throw new Error("Search failed")

      const json: SearchResponse = await res.json()

      // Combine suppliers from both name and product matches
      const suppliersByName = json.suppliersByName || []
      const suppliersByProduct = json.suppliersByProduct || []
      const allSuppliers = [...suppliersByName, ...suppliersByProduct]

      // Remove duplicates
      const uniqueSuppliers = allSuppliers.filter((supplier, index, self) =>
        index === self.findIndex((s) => s.supplier_account === supplier.supplier_account)
      )

      // Apply relevance filtering with higher threshold for category searches
      const filteredSuppliers = filterSuppliersByRelevance(
        uniqueSuppliers,
        suggestion,
        30 // Higher threshold for category searches to ensure accuracy
      )

      setSuggestions(filteredSuppliers)
      setShowSuggestions(filteredSuppliers.length > 0)
    } catch (error) {
      console.error("Quick search error:", error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <section className="py-6 bg-white border-y border-slate-200">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto" ref={wrapperRef}>
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Building2 className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                Search Suppliers
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Find suppliers by name, location, or business type
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search in English or Kinyarwanda (e.g., water, amazi, pharmacy...)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true)
                  }}
                  className="pl-10 pr-4 h-12 text-base border-2 border-slate-300 focus:border-blue-500 rounded-xl"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-blue-600" />
                )}
              </div>
              <Button
                type="submit"
                disabled={!query.trim()}
                className="h-12 px-6 rounded-xl font-semibold"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>

            {/* Translation Hint */}
            {translations && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                <Languages className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-slate-700">Also searching for: </span>
                  <span className="font-semibold text-blue-700">
                    {translations.english.slice(0, 3).join(", ")}
                    {translations.kinyarwanda.length > 0 && translations.kinyarwanda[0].toLowerCase() !== query.toLowerCase() && (
                      <> • {translations.kinyarwanda.slice(0, 2).join(", ")}</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Live Search Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white border-2 border-slate-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  {activeQuickSearch ? (
                    <p className="px-3 py-2 text-xs font-semibold text-blue-600 uppercase bg-blue-50 rounded-lg mb-2">
                      {activeQuickSearch} ({suggestions.length} found)
                    </p>
                  ) : (
                    <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                      Suppliers ({suggestions.length})
                    </p>
                  )}
                  {suggestions.map((supplier, index) => (
                    <button
                      key={supplier.supplier_account + index}
                      onClick={() => handleSupplierClick(supplier)}
                      className="w-full text-left px-3 py-3 hover:bg-blue-50 rounded-lg transition-colors flex items-start gap-3 group"
                    >
                      <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {supplier.supplier_name}
                        </p>
                        {supplier.supplier_location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <p className="text-xs text-slate-600 truncate">
                              {supplier.supplier_location}
                            </p>
                          </div>
                        )}
                        {supplier.productCount !== undefined && supplier.productCount > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Package className="h-3 w-3 text-slate-400" />
                            <p className="text-xs text-slate-500">
                              {supplier.productCount} products
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Quick search suggestions */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <p className="text-xs text-slate-500 w-full text-center mb-1">Quick searches:</p>
            {["Pharmacies", "Kigali suppliers", "Supermarkets", "Nearby shops"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleQuickSearch(suggestion)}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  activeQuickSearch === suggestion
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
