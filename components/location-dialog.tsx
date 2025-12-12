"use client"

import { useState } from "react"
import { MapPin, Navigation, Loader2, X, Search, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLocationStore } from "@/lib/location-store"
import { useRouter } from "next/navigation"

type LocationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Supplier = {
  supplierId: string
  supplierName: string
  location: string
  distance: number
  latitude?: number
  longitude?: number
  productCount?: number
  momo?: string
}

export function LocationDialog({ open, onOpenChange }: LocationDialogProps) {
  const router = useRouter()
  const {
    userLocation,
    isTracking,
    error: locationError,
    requestLocation,
    clearUserLocation,
  } = useLocationStore()

  const [searching, setSearching] = useState(false)
  const [nearestSuppliers, setNearestSuppliers] = useState<Supplier[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const handleGetLocation = async () => {
    setSearchError(null)
    const location = await requestLocation()
    if (location) {
      await searchNearestSuppliers(location.latitude, location.longitude)
    }
  }

  const searchNearestSuppliers = async (lat: number, lon: number) => {
    setSearching(true)
    setSearchError(null)
    try {
      const response = await fetch("/api/suppliers/nearest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          radius: 50,
          limit: 20,
          withStockOnly: true,
        }),
      })

      const result = await response.json()
      if (result.ok && result.suppliers) {
        // Filter out suppliers with 0 stock
        const suppliersWithStock = result.suppliers.filter(
          (s: Supplier) => s.productCount && s.productCount > 0
        )
        const sorted = suppliersWithStock.sort((a, b) => a.distance - b.distance)
        setNearestSuppliers(sorted.slice(0, 20))

        if (sorted.length === 0) {
          setSearchError("No suppliers with stock found nearby. Try expanding your search radius.")
        }
      } else {
        const msg = result.error || "Failed to find suppliers"
        setSearchError(result.hint ? `${msg}. ${result.hint}` : msg)
      }
    } catch (err: any) {
      setSearchError(err.message || "Network error occurred")
    } finally {
      setSearching(false)
    }
  }

  const handleSupplierClick = (supplier: Supplier) => {
    onOpenChange(false)
    const params = new URLSearchParams({
      q: supplier.supplierName,
      supplier: supplier.supplierId,
      supplierName: supplier.supplierName,
    })
    router.push(`/search?${params.toString()}`)
  }

  const formatDistance = (distance: number): string =>
    distance < 1
      ? `${Math.round(distance * 1000)}m`
      : distance < 10
      ? `${distance.toFixed(1)}km`
      : `${Math.round(distance)}km`

  const getDistanceColor = (distance: number): string => {
    if (distance < 2) return "text-green-600"
    if (distance < 10) return "text-blue-600"
    if (distance < 30) return "text-orange-600"
    return "text-gray-600"
  }

  const getDistanceBadge = (distance: number): string => {
    if (distance < 2) return "🎯 Very Close"
    if (distance < 5) return "📍 Nearby"
    if (distance < 15) return "🚗 Moderate"
    return "🛣️ Far"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:w-[90vw] md:w-[600px] lg:w-[700px] 
                   max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 
                   bg-white shadow-lg"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-900 font-bold">
            <MapPin className="h-6 w-6 text-blue-600 flex-shrink-0" />
            Find Nearest Suppliers
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-gray-600 leading-relaxed">
            Enable GPS to find the closest suppliers to you in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Get Location Button */}
          <Button
            onClick={handleGetLocation}
            disabled={isTracking || searching}
            className="w-full flex items-center justify-center gap-2 h-11 sm:h-12 text-sm sm:text-base font-semibold rounded-xl"
          >
            {isTracking || searching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span>{isTracking ? "Getting your location..." : "Searching suppliers..."}</span>
              </>
            ) : (
              <>
                <Navigation className="h-5 w-5 text-blue-600" />
                <span>Get My Location & Find Suppliers</span>
              </>
            )}
          </Button>

          {/* Errors */}
          {locationError && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p>{locationError}</p>
            </div>
          )}

          {searchError && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 text-sm text-orange-700 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p>{searchError}</p>
              </div>
            </div>
          )}

          {/* Location Display */}
          {userLocation && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-green-900 flex items-center gap-1">
                    <MapPin className="h-5 w-5 text-green-700" /> Your Location
                  </p>
                  {userLocation.address && (
                    <p className="text-sm text-green-800 mt-1 break-words">
                      📍 {userLocation.address}
                    </p>
                  )}
                  <p className="text-xs mt-1 text-green-700 font-mono">
                    {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    🎯 Accuracy ±{Math.round(userLocation.accuracy)}m
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearUserLocation()
                    setNearestSuppliers([])
                    setSearchError(null)
                  }}
                  className="p-1 hover:bg-green-200 rounded-full"
                >
                  <X className="h-5 w-5 text-green-900" />
                </Button>
              </div>
            </div>
          )}

          {/* Searching Loader */}
          {searching && (
            <div className="flex justify-center items-center py-4 gap-2 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <p className="text-sm sm:text-base">Calculating distances...</p>
            </div>
          )}

          {/* Nearest Suppliers */}
          {nearestSuppliers.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                    Nearest Suppliers ({nearestSuppliers.length})
                  </h3>
                </div>
                <span className="text-xs sm:text-sm text-gray-500">By distance</span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {nearestSuppliers.map((supplier, index) => (
                  <button
                    key={supplier.supplierId || index}
                    onClick={() => handleSupplierClick(supplier)}
                    className={`w-full text-left p-4 border-2 rounded-xl transition-all overflow-hidden 
                      hover:shadow-lg focus:ring-2 focus:ring-blue-400
                      ${index === 0
                        ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                        : index < 3
                        ? "border-green-400 bg-green-50 hover:bg-green-100"
                        : "border-gray-300 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 overflow-hidden">
                        {index < 3 && (
                          <span className={`text-xs sm:text-sm px-3 py-1 rounded-full font-bold inline-block mb-2
                            ${index === 0
                              ? "bg-blue-600 text-white"
                              : index === 1
                              ? "bg-green-600 text-white"
                              : "bg-orange-500 text-white"}`}>
                            {index === 0 ? "🏆 CLOSEST" : `#${index + 1}`}
                          </span>
                        )}

                        <h4 className="font-bold text-gray-900 text-base sm:text-lg truncate">
                          {supplier.supplierName}
                        </h4>
                        {supplier.location && (
                          <p className="text-gray-700 text-sm truncate">📍 {supplier.location}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`font-bold ${getDistanceColor(supplier.distance)}`}>
                            🚗 {formatDistance(supplier.distance)}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-600">
                            {getDistanceBadge(supplier.distance)}
                          </span>
                        </div>
                      </div>
                      {supplier.productCount !== undefined && (
                        <span className="text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded-md border">
                          {supplier.productCount} items
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Suppliers */}
          {!searching && userLocation && nearestSuppliers.length === 0 && !searchError && (
            <div className="text-center py-6 sm:py-8">
              <MapPin className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No suppliers found within 50km</p>
              <p className="text-xs text-gray-500">Try increasing your search radius</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 leading-relaxed">
            <strong>🎯 Smart Search:</strong> Only shows suppliers with stock, sorted by GPS distance.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
