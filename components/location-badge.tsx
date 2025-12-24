"use client"

import { MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { LocationCaptureDialog } from "@/components/location-capture-dialog"
import { useState } from "react"

export function LocationBadge() {
  const { location, clearLocation, hasAskedForLocation, isLocationExpired } = useLocationStoreEnhanced()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Don't auto-open dialog - only show when user clicks the button
  // This prevents the popup from appearing on every page refresh

  if (!location) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="text-xs"
        >
          <MapPin className="h-3 w-3 mr-1" />
          Set Location
        </Button>
        <LocationCaptureDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  return (
    <>
      <Badge variant="secondary" className="gap-1 px-2 py-1">
        <MapPin className="h-3 w-3" />
        <span className="text-xs">
          Near {location.district}
          {location.cell && `, ${location.cell}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent"
          onClick={() => setDialogOpen(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
      <LocationCaptureDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

