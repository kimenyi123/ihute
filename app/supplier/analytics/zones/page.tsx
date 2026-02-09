'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface ActivityZone {
    zone_id: number
    zone_name: string
    center_lat: number
    center_lng: number
    geohash: string
    radius_m: number
    visit_count: number
    first_visit: string
    last_visit: string
    total_time_minutes: number
    common_hours: number[]
}

export default function ActivityZonesPage() {
    const [zones, setZones] = useState<ActivityZone[]>([])
    const [loading, setLoading] = useState(false)
    const [daysBack, setDaysBack] = useState(30)

    useEffect(() => {
        fetchZones()
    }, [daysBack])

    const fetchZones = async () => {
        setLoading(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE}/ActivityZoneServlet?daysBack=${daysBack}`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const data = await res.json()
                setZones(data.zones || [])
            }
        } catch (error) {
            console.error('Error fetching zones:', error)
        } finally {
            setLoading(false)
        }
    }

    const getZoneColor = (index: number) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
        return colors[index % colors.length]
    }

    const center = zones.length > 0
        ? [zones[0].center_lat, zones[0].center_lng]
        : [-1.9536, 30.0619]

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Activity Zones</h1>

                {/* Controls */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center gap-4">
                        <label className="font-medium">Analysis Period:</label>
                        <select
                            value={daysBack}
                            onChange={(e) => setDaysBack(Number(e.target.value))}
                            className="border rounded px-3 py-2"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>

                        <button
                            onClick={fetchZones}
                            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Map */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
                        {loading ? (
                            <div className="h-96 flex items-center justify-center">
                                <div className="text-xl">Analyzing activity zones...</div>
                            </div>
                        ) : (
                            <MapContainer
                                center={center as [number, number]}
                                zoom={12}
                                style={{ height: '600px', width: '100%' }}
                                className="rounded-lg"
                            >
                                <TileLayer
                                    attribution='&copy; OpenStreetMap'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                {zones.map((zone, index) => (
                                    <Circle
                                        key={zone.zone_id}
                                        center={[zone.center_lat, zone.center_lng]}
                                        radius={zone.radius_m}
                                        pathOptions={{
                                            fillColor: getZoneColor(index),
                                            fillOpacity: 0.2,
                                            color: getZoneColor(index),
                                            weight: 2
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <strong>{zone.zone_name}</strong><br />
                                                Visits: {zone.visit_count}<br />
                                                Time spent: {Math.round(zone.total_time_minutes / 60)} hours<br />
                                                Common hours: {zone.common_hours.join(', ')}:00
                                            </div>
                                        </Popup>
                                    </Circle>
                                ))}
                            </MapContainer>
                        )}
                    </div>

                    {/* Zone Statistics */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-lg shadow p-4">
                            <h2 className="font-bold text-lg mb-4">Detected Zones</h2>

                            {zones.length === 0 ? (
                                <div className="text-gray-500 text-sm">
                                    No activity zones detected. Need more location data.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {zones.map((zone, index) => (
                                        <div key={zone.zone_id} className="border-l-4 pl-3 py-2" style={{ borderColor: getZoneColor(index) }}>
                                            <div className="font-medium">{zone.zone_name}</div>
                                            <div className="text-sm text-gray-600 space-y-1 mt-1">
                                                <div>📍 Radius: {zone.radius_m}m</div>
                                                <div>🔄 Visits: {zone.visit_count}</div>
                                                <div>⏱️ Time: {Math.round(zone.total_time_minutes / 60)}h</div>
                                                <div>🕐 Peak: {zone.common_hours[0]}:00</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Summary Stats */}
                        {zones.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-4">
                                <h3 className="font-medium mb-3">Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Zones:</span>
                                        <span className="font-medium">{zones.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Visits:</span>
                                        <span className="font-medium">{zones.reduce((sum, z) => sum + z.visit_count, 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Time:</span>
                                        <span className="font-medium">{Math.round(zones.reduce((sum, z) => sum + z.total_time_minutes, 0) / 60)}h</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
