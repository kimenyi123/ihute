'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { format, parseISO } from 'date-fns'

interface RoutePoint {
    lat: number
    lng: number
    geohash: string
    accuracy: number
    speed: number
    heading: number
    time: string
    distance_from_prev_m?: number
}

interface RouteData {
    date: string
    supplier_id: string
    points: RoutePoint[]
    total_distance_km: number
    max_speed_ms: number
    duration_minutes: number
}

export default function SupplierRoutesPage() {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [routeData, setRouteData] = useState<RouteData | null>(null)
    const [loading, setLoading] = useState(false)
    const [playback, setPlayback] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        fetchRoute(selectedDate)
    }, [selectedDate])

    const fetchRoute = async (date: string) => {
        setLoading(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE}/Kaos/SupplierRouteHistoryServlet?action=daily&date=${date}`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const data = await res.json()
                setRouteData(data)
                setCurrentIndex(data.points.length - 1)
            }
        } catch (error) {
            console.error('Error fetching route:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePlayback = () => {
        if (!routeData) return

        setPlayback(true)
        setCurrentIndex(0)

        const interval = setInterval(() => {
            setCurrentIndex((prev) => {
                if (prev >= routeData.points.length - 1) {
                    setPlayback(false)
                    clearInterval(interval)
                    return prev
                }
                return prev + 1
            })
        }, 500) // 0.5 second per point
    }

    const getSpeedColor = (speed: number) => {
        if (speed < 0.5) return '#94a3b8' // stationary - gray
        if (speed < 2) return '#3b82f6' // walking - blue
        if (speed < 5) return '#eab308' // cycling - yellow
        return '#ef4444' // driving - red
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Route History</h1>

                {/* Date Picker */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center gap-4">
                        <label className="font-medium">Select Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="border rounded px-3 py-2"
                        />

                        {routeData && (
                            <button
                                onClick={handlePlayback}
                                disabled={playback}
                                className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                {playback ? '▶️ Playing...' : '▶️ Play Route'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                {routeData && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600">Total Distance</div>
                            <div className="text-2xl font-bold">{routeData.total_distance_km} km</div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600">Duration</div>
                            <div className="text-2xl font-bold">{routeData.duration_minutes} min</div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600">Max Speed</div>
                            <div className="text-2xl font-bold">{(routeData.max_speed_ms * 3.6).toFixed(1)} km/h</div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600">Data Points</div>
                            <div className="text-2xl font-bold">{routeData.points.length}</div>
                        </div>
                    </div>
                )}

                {/* Map */}
                <div className="bg-white rounded-lg shadow p-4">
                    {loading ? (
                        <div className="h-96 flex items-center justify-center">
                            <div className="text-xl">Loading route...</div>
                        </div>
                    ) : routeData && routeData.points.length > 0 ? (
                        <MapContainer
                            center={[routeData.points[0].lat, routeData.points[0].lng]}
                            zoom={13}
                            style={{ height: '600px', width: '100%' }}
                            className="rounded-lg"
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {/* Route Polyline */}
                            <Polyline
                                positions={routeData.points.slice(0, currentIndex + 1).map(p => [p.lat, p.lng])}
                                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7 }}
                            />

                            {/* Start Marker */}
                            <CircleMarker
                                center={[routeData.points[0].lat, routeData.points[0].lng]}
                                radius={10}
                                pathOptions={{ fillColor: '#22c55e', color: 'white', weight: 2, fillOpacity: 1 }}
                            >
                                <Popup>
                                    <div className="text-sm">
                                        <strong>Start</strong><br />
                                        {format(parseISO(routeData.points[0].time), 'HH:mm:ss')}
                                    </div>
                                </Popup>
                            </CircleMarker>

                            {/* End Marker (current position in playback) */}
                            {currentIndex > 0 && (
                                <CircleMarker
                                    center={[routeData.points[currentIndex].lat, routeData.points[currentIndex].lng]}
                                    radius={10}
                                    pathOptions={{ fillColor: '#ef4444', color: 'white', weight: 2, fillOpacity: 1 }}
                                >
                                    <Popup>
                                        <div className="text-sm">
                                            <strong>Current Position</strong><br />
                                            {format(parseISO(routeData.points[currentIndex].time), 'HH:mm:ss')}<br />
                                            Speed: {(routeData.points[currentIndex].speed * 3.6).toFixed(1)} km/h
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            )}

                            {/* Speed-coded markers along route */}
                            {routeData.points.slice(0, currentIndex + 1).filter((_, i) => i % 5 === 0).map((point, i) => (
                                <CircleMarker
                                    key={i}
                                    center={[point.lat, point.lng]}
                                    radius={4}
                                    pathOptions={{
                                        fillColor: getSpeedColor(point.speed),
                                        color: 'white',
                                        weight: 1,
                                        fillOpacity: 0.8
                                    }}
                                >
                                    <Popup>
                                        <div className="text-xs">
                                            <strong>{format(parseISO(point.time), 'HH:mm')}</strong><br />
                                            Speed: {(point.speed * 3.6).toFixed(1)} km/h<br />
                                            Accuracy: ±{point.accuracy.toFixed(0)}m
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            ))}
                        </MapContainer>
                    ) : (
                        <div className="h-96 flex items-center justify-center text-gray-500">
                            No route data for selected date
                        </div>
                    )}
                </div>

                {/* Legend */}
                {routeData && routeData.points.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg shadow p-4">
                        <div className="font-medium mb-2">Speed Legend:</div>
                        <div className="flex gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-slate-400"></div>
                                <span className="text-sm">Stationary (&lt;0.5 m/s)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                                <span className="text-sm">Walking (0.5-2 m/s)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                                <span className="text-sm">Cycling (2-5 m/s)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                                <span className="text-sm">Driving (&gt;5 m/s)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
