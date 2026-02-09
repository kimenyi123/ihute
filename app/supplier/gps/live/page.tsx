"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Navigation, Gauge, Clock, Edit2, Save, X } from "lucide-react"
import Link from "next/link"

export default function LiveLocationPage() {
    const router = useRouter()
    const { user, isAuthenticated, hasHydrated } = useAuthStore()
    const mapRef = useRef<HTMLDivElement>(null)

    const [location, setLocation] = useState<{
        lat: number
        lng: number
        accuracy: number
        timestamp: Date
    } | null>(null)
    const [watching, setWatching] = useState(false)
    const [manualEdit, setManualEdit] = useState(false)
    const [editLat, setEditLat] = useState("")
    const [editLng, setEditLng] = useState("")

    useEffect(() => {
        if (!hasHydrated) return
        if (!isAuthenticated || user?.role !== "supplier") {
            router.push("/login")
            return
        }
    }, [hasHydrated, isAuthenticated, user, router])

    useEffect(() => {
        if (!watching) return

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: new Date()
                })
            },
            (error) => {
                console.error("GPS error:", error)
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            }
        )

        return () => navigator.geolocation.clearWatch(watchId)
    }, [watching])

    const startTracking = () => {
        setWatching(true)
    }

    const stopTracking = () => {
        setWatching(false)
    }

    const saveManualLocation = async () => {
        const lat = parseFloat(editLat)
        const lng = parseFloat(editLng)

        if (isNaN(lat) || isNaN(lng)) {
            alert("Invalid coordinates")
            return
        }

        try {
            const res = await fetch("/api/supplier/location/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lat,
                    lng,
                    accuracy: 0,
                    speed: 0,
                    heading: 0,
                    source: "manual_override"
                }),
                credentials: "include"
            })

            if (res.ok) {
                setLocation({ lat, lng, accuracy: 0, timestamp: new Date() })
                setManualEdit(false)
                alert("Location updated successfully!")
            } else {
                alert("Failed to update location")
            }
        } catch (error) {
            alert("Error updating location")
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/supplier/dashboard">
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Live Location</h1>
                                <p className="text-sm text-slate-600">Current position & real-time tracking</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map Container */}
                    <div className="lg:col-span-2">
                        <Card className="h-[600px]">
                            <CardContent className="p-0 h-full">
                                <div
                                    ref={mapRef}
                                    className="w-full h-full rounded-lg bg-slate-100 flex items-center justify-center relative overflow-hidden"
                                >
                                    {/* Leaflet/Google Maps would go here, using static placeholder for now */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                                        {location ? (
                                            <div className="text-center space-y-4">
                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className={`w-32 h-32 rounded-full bg-blue-500/20 ${watching ? 'animate-ping' : ''}`}></div>
                                                    </div>
                                                    <MapPin className="h-16 w-16 text-blue-600 relative z-10 mx-auto drop-shadow-lg" />
                                                </div>
                                                <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg">
                                                    <div className="text-sm font-medium text-slate-600">Current Location</div>
                                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-2">
                                                        Accuracy: {location.accuracy.toFixed(0)}m
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <MapPin className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                                                <p className="text-slate-600 font-medium">No GPS data yet</p>
                                                <p className="text-sm text-slate-500 mt-2">Click "Start Tracking" to begin</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Map Integration Note */}
                                    <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-3 py-2 rounded text-xs">
                                        💡 Integrate Leaflet or Google Maps here
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Controls Panel */}
                    <div className="space-y-6">
                        {/* Tracking Controls */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Tracking Controls</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!watching ? (
                                    <Button
                                        onClick={startTracking}
                                        className="w-full gap-2 bg-green-600 hover:bg-green-700"
                                    >
                                        <Navigation className="h-4 w-4" />
                                        Start Tracking
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={stopTracking}
                                        variant="destructive"
                                        className="w-full gap-2"
                                    >
                                        <X className="h-4 w-4" />
                                        Stop Tracking
                                    </Button>
                                )}

                                <Button
                                    onClick={() => setManualEdit(!manualEdit)}
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <Edit2 className="h-4 w-4" />
                                    Manual Override
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Manual Location Override */}
                        {manualEdit && (
                            <Card className="border-blue-200 bg-blue-50/50">
                                <CardHeader>
                                    <CardTitle className="text-lg">Manual Location</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">Latitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={editLat}
                                            onChange={(e) => setEditLat(e.target.value)}
                                            placeholder="-1.95408"
                                            className="w-full mt-1 px-3 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">Longitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={editLng}
                                            onChange={(e) => setEditLng(e.target.value)}
                                            placeholder="30.099339"
                                            className="w-full mt-1 px-3 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={saveManualLocation}
                                            className="flex-1 gap-2"
                                        >
                                            <Save className="h-4 w-4" />
                                            Save
                                        </Button>
                                        <Button
                                            onClick={() => setManualEdit(false)}
                                            variant="outline"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        💡 Use this if GPS is inaccurate or unavailable
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Location Info */}
                        {location && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Gauge className="h-5 w-5 text-blue-600" />
                                        Location Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <div className="text-xs text-slate-600">Latitude</div>
                                        <div className="text-sm font-mono font-medium">{location.lat.toFixed(6)}°</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-600">Longitude</div>
                                        <div className="text-sm font-mono font-medium">{location.lng.toFixed(6)}°</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-600">Accuracy</div>
                                        <div className="text-sm font-medium">{location.accuracy.toFixed(0)} meters</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-600 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            Last Update
                                        </div>
                                        <div className="text-sm font-medium">{location.timestamp.toLocaleTimeString()}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
