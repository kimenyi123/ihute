"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Clock, CheckCircle2, XCircle } from "lucide-react"
import { useLocationStoreEnhanced } from "@/lib/location-store-enhanced"

/**
 * Location Verification Component
 * Shows real-time GPS data and stored location to verify tracking accuracy
 */
export function LocationVerification() {
    const { location } = useLocationStoreEnhanced()
    const [currentGPS, setCurrentGPS] = useState<GeolocationPosition | null>(null)
    const [gpsError, setGpsError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const getCurrentPosition = () => {
        setLoading(true)
        setGpsError(null)

        if (!navigator.geolocation) {
            setGpsError("Geolocation not supported by your browser")
            setLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCurrentGPS(position)
                setLoading(false)
            },
            (error) => {
                setGpsError(error.message)
                setLoading(false)
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0, // Don't use cached position
            }
        )
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    Location Tracking Verification
                </CardTitle>
                <CardDescription>
                    Verify that real GPS coordinates are being captured and stored
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Stored Location */}
                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Stored Location Data
                    </h3>
                    {location ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm">
                                        <span className="font-medium">District:</span> {location.district}
                                    </p>
                                    {location.cell && (
                                        <p className="text-sm">
                                            <span className="font-medium">Cell:</span> {location.cell}
                                        </p>
                                    )}
                                    {location.province && (
                                        <p className="text-sm">
                                            <span className="font-medium">Province:</span> {location.province}
                                        </p>
                                    )}
                                </div>
                                <Badge variant={location.source === "gps" ? "default" : "secondary"}>
                                    {location.source === "gps" ? "GPS" : "Manual"}
                                </Badge>
                            </div>
                            {location.latitude && location.longitude && (
                                <div className="pt-2 border-t border-green-300 space-y-1">
                                    <p className="text-xs text-green-900 font-mono">
                                        📍 Lat: {location.latitude.toFixed(6)}°
                                    </p>
                                    <p className="text-xs text-green-900 font-mono">
                                        📍 Lon: {location.longitude.toFixed(6)}°
                                    </p>
                                    <a
                                        href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                                    >
                                        View on Google Maps →
                                    </a>
                                </div>
                            )}
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Captured: {new Date(location.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600">No location data stored yet</p>
                        </div>
                    )}
                </div>

                {/* Real-time GPS Test */}
                <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        Real-time GPS Test
                    </h3>
                    <Button onClick={getCurrentPosition} disabled={loading} className="w-full">
                        {loading ? "Getting GPS..." : "Get Current GPS Position"}
                    </Button>

                    {currentGPS && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-blue-900">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">GPS Signal Acquired!</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-blue-900 font-mono">
                                    📍 Latitude: {currentGPS.coords.latitude.toFixed(6)}°
                                </p>
                                <p className="text-xs text-blue-900 font-mono">
                                    📍 Longitude: {currentGPS.coords.longitude.toFixed(6)}°
                                </p>
                                <p className="text-xs text-blue-900">
                                    🎯 Accuracy: ±{currentGPS.coords.accuracy.toFixed(0)} meters
                                </p>
                                {currentGPS.coords.altitude && (
                                    <p className="text-xs text-blue-900">
                                        ⛰️ Altitude: {currentGPS.coords.altitude.toFixed(0)}m
                                    </p>
                                )}
                            </div>
                            <a
                                href={`https://www.google.com/maps?q=${currentGPS.coords.latitude},${currentGPS.coords.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                                View on Google Maps →
                            </a>
                        </div>
                    )}

                    {gpsError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-sm text-red-900">
                                <XCircle className="h-4 w-4" />
                                <span className="font-medium">GPS Error: {gpsError}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Comparison */}
                {location?.latitude && location?.longitude && currentGPS && (
                    <div className="space-y-2">
                        <h3 className="font-semibold">Comparison</h3>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-sm text-purple-900">
                                <span className="font-medium">Distance moved:</span>{" "}
                                {calculateDistance(
                                    location.latitude,
                                    location.longitude,
                                    currentGPS.coords.latitude,
                                    currentGPS.coords.longitude
                                ).toFixed(2)}{" "}
                                km
                            </p>
                            <p className="text-xs text-purple-700 mt-1">
                                {Math.abs(location.timestamp - Date.now()) / 1000 / 60 < 5
                                    ? "✅ Coordinates are fresh and accurate"
                                    : "⚠️ Stored location may be outdated"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-blue-900 leading-relaxed">
                        <strong>How it works:</strong> When you allow location access, the browser uses
                        your device's GPS, WiFi, and cell tower data to determine your exact coordinates.
                        These coordinates are then reverse-geocoded to find your district and cell in Rwanda.
                        The "Real-time GPS Test" button above proves this is capturing your actual location,
                        not simulated data.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Radius of Earth in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}
