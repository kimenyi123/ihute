"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, Loader2, X } from "lucide-react"
import { useLocationStoreEnhanced, reverseGeocodeToDistrict, type LocationData } from "@/lib/location-store-enhanced"
import { RWANDA_DISTRICTS } from "@/lib/constants"

interface LocationCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Common cells per district (simplified - in production, fetch from API)
const DISTRICT_CELLS: Record<string, string[]> = {
  Kicukiro: ["Kagarama", "Gikondo", "Niboye", "Kanombe", "Gatenga", "Kinyinya"],
  Gasabo: ["Kimisagara", "Remera", "Kimironko", "Kacyiru", "Gisozi", "Jali"],
  Nyarugenge: ["Nyamirambo", "Kimisagara", "Gitega", "Rwezamenyo", "Muhima"],
  // Add more as needed
}

export function LocationCaptureDialog({ open, onOpenChange }: LocationCaptureDialogProps) {
  const { setLocation, setHasAskedForLocation } = useLocationStoreEnhanced()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string>("")
  const [selectedCell, setSelectedCell] = useState<string>("")
  const [mode, setMode] = useState<"ask" | "gps" | "manual">("ask")

  useEffect(() => {
    if (open && mode === "ask") {
      setSelectedDistrict("")
      setSelectedCell("")
      setError(null)
    }
  }, [open, mode])

  const handleAllowGPS = async () => {
    setLoading(true)
    setError(null)
    setMode("gps")

    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported")
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000, // Increased to 30 seconds
          maximumAge: 60000, // Accept cached position up to 1 minute old
        })
      })

      // Reverse geocode to district and cell
      const geoData = await reverseGeocodeToDistrict(
        position.coords.latitude,
        position.coords.longitude
      )

      if (!geoData || !geoData.district) {
        throw new Error("Could not determine your location. Please select manually.")
      }

      const locationData: LocationData = {
        district: geoData.district,
        cell: geoData.cell,
        province: geoData.province,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
        source: "gps",
      }

      setLocation(locationData)
      setHasAskedForLocation(true)
      onOpenChange(false)
    } catch (err: any) {
      console.error("GPS location error:", err)
      setError(
        err.code === 1
          ? "Location access denied. Please select manually."
          : err.message || "Failed to get location"
      )
      setMode("manual")
    } finally {
      setLoading(false)
    }
  }

  const handleManualSelect = () => {
    setMode("manual")
  }

  const handleSkip = () => {
    setHasAskedForLocation(true)
    onOpenChange(false)
  }

  const handleSaveManual = () => {
    if (!selectedDistrict) {
      setError("Please select a district")
      return
    }

    const locationData: LocationData = {
      district: selectedDistrict,
      cell: selectedCell && selectedCell !== "all" ? selectedCell : undefined,
      timestamp: Date.now(),
      source: "manual",
    }

    setLocation(locationData)
    setHasAskedForLocation(true)
    onOpenChange(false)
  }

  const availableCells = selectedDistrict ? (DISTRICT_CELLS[selectedDistrict] || []) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Show Nearby Suppliers
          </DialogTitle>
          <DialogDescription>
            Allow location access to see suppliers near you first, or choose your location manually.
          </DialogDescription>
        </DialogHeader>

        {mode === "ask" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Button
                onClick={handleAllowGPS}
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Allow Location
                  </>
                )}
              </Button>
              <Button
                onClick={handleManualSelect}
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                Choose Location Manually
              </Button>
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full"
                disabled={loading}
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {mode === "gps" && loading && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-muted-foreground">Getting your location...</p>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">District *</label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {RWANDA_DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDistrict && availableCells.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cell (Optional)</label>
                <Select value={selectedCell} onValueChange={setSelectedCell}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cell (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cells</SelectItem>
                    {availableCells.map((cell) => (
                      <SelectItem key={cell} value={cell}>
                        {cell}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleSaveManual} disabled={!selectedDistrict}>
                Save Location
              </Button>
              <Button onClick={handleSkip} variant="ghost">
                Skip
              </Button>
            </DialogFooter>
          </div>
        )}

        {error && mode !== "manual" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

