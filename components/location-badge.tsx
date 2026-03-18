"use client"

import { MapPin, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"
import { LocationCaptureDialog } from "@/components/location-capture-dialog"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function LocationBadge({ compact = false }: { compact?: boolean }) {
  const { location, clearLocation } = useLocationStoreEnhanced()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const handleClearLocation = () => {
    clearLocation()
    setConfirmClearOpen(false)
  }

  if (!location) {
    return (
      <>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          onClick={() => setDialogOpen(true)}
          className={compact ? "h-9 w-9 shrink-0" : "text-xs"}
          title="Set location"
        >
          <MapPin className={compact ? "h-4 w-4" : "h-3 w-3 mr-1"} />
          {!compact && <span>Set Location</span>}
        </Button>
        <LocationCaptureDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  return (
    <>
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 shrink-0 cursor-pointer",
          compact ? "h-9 px-2 py-0 gap-1" : "px-2 py-1"
        )}
        onClick={() => setDialogOpen(true)}
      >
        <MapPin className="h-3 w-3" />
        <span className="text-xs max-w-[100px] truncate">
          {compact ? `Near ${location.district}` : `Near ${location.district}${location.cell ? `, ${location.cell}` : ""}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setConfirmClearOpen(true)
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>

      <LocationCaptureDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Clear Location Tracking?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to remove your location tracking for suppliers?
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-900">
                <strong>You will lose:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Personalized supplier recommendations near you</li>
                  <li>Distance-based sorting and filtering</li>
                  <li>Location-aware search results</li>
                </ul>
              </div>
              <p className="text-sm">
                You can always set your location again later by clicking "Set Location".
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLocation}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Clear Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

