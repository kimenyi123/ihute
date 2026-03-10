"use client"

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Loader2, AlertCircle, CheckCircle, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGeolocation } from '@/hooks/use-geolocation'

// Load map in a separate client-only component so Leaflet mounts once (avoids "container already initialized")
const GPSCaptureMapInner = dynamic(
  () => import('@/components/gps-capture-map').then((m) => m.GPSCaptureMapInner),
  { ssr: false }
)

// Rwanda bounds for validation
const RWANDA_BOUNDS = {
    latMin: -2.9,
    latMax: -1.0,
    lngMin: 28.8,
    lngMax: 30.9
}

// Kigali center as default
const KIGALI_CENTER = { lat: -1.9536, lng: 30.0606 }

interface GPSCaptureProps {
    onLocationSet: (lat: number, lng: number, accuracy: number) => void
    initialLat?: number
    initialLng?: number
}

export function GPSCapture({ onLocationSet, initialLat, initialLng }: GPSCaptureProps) {
    const { location: gpsLocation, loading: gpsLoading, error: gpsError, denied: gpsDenied } = useGeolocation()
    const [position, setPosition] = useState<{ lat: number, lng: number } | null>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
    )
    const [accuracy, setAccuracy] = useState<number | null>(null)
    const [mapReady, setMapReady] = useState(false)
    const [canRenderMap, setCanRenderMap] = useState(false)
    const [capturing, setCapturing] = useState(false)

    useEffect(() => {
        setMapReady(typeof window !== 'undefined')
    }, [])

    // Delay map mount until after Strict Mode so Leaflet only inits once
    useEffect(() => {
        if (!mapReady) return
        const t = setTimeout(() => setCanRenderMap(true), 200)
        return () => clearTimeout(t)
    }, [mapReady])

    // Update position when GPS location changes
    useEffect(() => {
        if (gpsLocation && capturing) {
            const newPos = { lat: gpsLocation.lat, lng: gpsLocation.lng }

            // Validate Rwanda bounds
            if (isInRwanda(newPos.lat, newPos.lng)) {
                setPosition(newPos)
                setAccuracy(gpsLocation.accuracy || null)
                setCapturing(false)
            } else {
                alert('GPS location is outside Rwanda. Please drag the pin to your actual location.')
                setCapturing(false)
            }
        }
    }, [gpsLocation, capturing])

    const isInRwanda = (lat: number, lng: number): boolean => {
        return lat >= RWANDA_BOUNDS.latMin && lat <= RWANDA_BOUNDS.latMax &&
            lng >= RWANDA_BOUNDS.lngMin && lng <= RWANDA_BOUNDS.lngMax
    }

    const handleCaptureGPS = () => {
        setCapturing(true)
    }

    const handleConfirm = () => {
        if (position) {
            if (!isInRwanda(position.lat, position.lng)) {
                alert('Please select a location within Rwanda')
                return
            }
            onLocationSet(position.lat, position.lng, accuracy || 5000)
        }
    }

    const getAccuracyColor = (acc: number | null): string => {
        if (!acc) return 'text-gray-500'
        if (acc < 50) return 'text-green-600'
        if (acc < 200) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getAccuracyLabel = (acc: number | null): string => {
        if (!acc) return 'Unknown'
        if (acc < 50) return 'Excellent'
        if (acc < 200) return 'Good'
        return 'Poor'
    }

    return (
        <div className="space-y-4">
            {/* GPS Capture Button */}
            <div className="flex flex-col gap-3">
                <Button
                    type="button"
                    onClick={handleCaptureGPS}
                    disabled={gpsLoading || capturing}
                    className="w-full gap-2"
                    variant="outline"
                >
                    {capturing || gpsLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Getting your location...
                        </>
                    ) : (
                        <>
                            <Navigation className="h-4 w-4" />
                            Use My Current Location
                        </>
                    )}
                </Button>

                {/* GPS Status Messages */}
                {gpsDenied && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Location access denied</p>
                            <p className="text-xs mt-1">Please drag the pin on the map to your business location manually.</p>
                        </div>
                    </div>
                )}

                {gpsError && !gpsDenied && (
                    <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Could not get location</p>
                            <p className="text-xs mt-1">You can manually drag the pin to your location on the map below.</p>
                        </div>
                    </div>
                )}

                {position && accuracy && (
                    <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="font-medium">Location captured</p>
                            <p className="text-xs mt-1">
                                Accuracy: <span className={`font-medium ${getAccuracyColor(accuracy)}`}>
                                    {accuracy.toFixed(0)}m ({getAccuracyLabel(accuracy)})
                                </span>
                            </p>
                            <p className="text-xs mt-1">
                                Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Map Preview - only mount map after canRenderMap to avoid double-init in Strict Mode */}
            {mapReady && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        📍 Business Location
                        <span className="text-xs text-gray-500 ml-2">(Click map or drag pin to adjust)</span>
                    </label>
                    <div className="h-[400px] rounded-lg overflow-hidden border-2 border-gray-300 relative z-0">
                        {canRenderMap && (
                            <div className="h-full w-full">
                                <GPSCaptureMapInner
                                    center={position || KIGALI_CENTER}
                                    position={position}
                                    setPosition={(latlng) => setPosition({ lat: latlng.lat, lng: latlng.lng })}
                                />
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        💡 Tip: Click anywhere on the map or drag the pin to set your exact business location
                    </p>
                </div>
            )}

            {/* Confirm Button */}
            <Button
                type="button"
                onClick={handleConfirm}
                disabled={!position}
                className="w-full gap-2"
            >
                <CheckCircle className="h-4 w-4" />
                Confirm Location & Continue
            </Button>
        </div>
    )
}
