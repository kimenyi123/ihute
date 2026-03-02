'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Rectangle, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface CoverageGrid {
    geohash: string
    supplier_count: number
    center_lat: number
    center_lng: number
    avg_accuracy: number
    last_updated: string
}

export default function AdminCoveragePage() {
    const [grids, setGrids] = useState<CoverageGrid[]>([])
    const [loading, setLoading] = useState(false)
    const [precision, setPrecision] = useState(6)

    useEffect(() => {
        fetchCoverage()
    }, [precision])

    const fetchCoverage = async () => {
        setLoading(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE}/AdminCoverageAnalyticsServlet?precision=${precision}`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const data = await res.json()
                setGrids(data.grids || [])
            }
        } catch (error) {
            console.error('Error fetching coverage:', error)
        } finally {
            setLoading(false)
        }
    }

    const getHeatColor = (count: number) => {
        if (count >= 20) return '#dc2626' // red - high
        if (count >= 10) return '#f59e0b' // orange - medium
        if (count >= 5) return '#eab308' // yellow - low-medium
        return '#3b82f6' // blue - low
    }

    const center: [number, number] = grids.length > 0
        ? [grids[0].center_lat, grids[0].center_lng]
        : [-1.9536, 30.0619]

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Supplier Coverage Map</h1>

                {/* Controls */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center gap-4">
                        <label className="font-medium">Heatmap Precision:</label>
                        <select
                            value={precision}
                            onChange={(e) => setPrecision(Number(e.target.value))}
                            className="border rounded px-3 py-2"
                        >
                            <option value={4}>Low (±20 km cells)</option>
                            <option value={5}>Medium (±2.4 km cells)</option>
                            <option value={6}>High (±610 m cells)</option>
                            <option value={7}>Very High (±76 m cells)</option>
                        </select>

                        <button
                            onClick={fetchCoverage}
                            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Total Active Grids</div>
                        <div className="text-2xl font-bold">{grids.length}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Total Suppliers</div>
                        <div className="text-2xl font-bold">
                            {grids.reduce((sum, g) => sum + g.supplier_count, 0)}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Highest Density</div>
                        <div className="text-2xl font-bold">
                            {Math.max(...grids.map(g => g.supplier_count), 0)} suppliers
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-600">Avg Accuracy</div>
                        <div className="text-2xl font-bold">
                            {grids.length > 0
                                ? Math.round(grids.reduce((sum, g) => sum + g.avg_accuracy, 0) / grids.length)
                                : 0}m
                        </div>
                    </div>
                </div>

                {/* Map */}
                <div className="bg-white rounded-lg shadow p-4">
                    {loading ? (
                        <div className="h-96 flex items-center justify-center">
                            <div className="text-xl">Loading coverage data...</div>
                        </div>
                    ) : grids.length > 0 ? (
                        <>
                            <MapContainer
                                center={center}
                                zoom={10}
                                style={{ height: '600px', width: '100%' }}
                                className="rounded-lg"
                            >
                                <TileLayer
                                    attribution='&copy; OpenStreetMap'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                {grids.map((grid, index) => {
                                    // Approximate grid bounds from geohash
                                    const offset = precision === 4 ? 0.2 : precision === 5 ? 0.02 : precision === 6 ? 0.006 : 0.0008

                                    return (
                                        <Rectangle
                                            key={index}
                                            bounds={[
                                                [grid.center_lat - offset, grid.center_lng - offset],
                                                [grid.center_lat + offset, grid.center_lng + offset]
                                            ]}
                                            pathOptions={{
                                                fillColor: getHeatColor(grid.supplier_count),
                                                fillOpacity: 0.5,
                                                color: getHeatColor(grid.supplier_count),
                                                weight: 1
                                            }}
                                        >
                                            <Popup>
                                                <div className="text-sm">
                                                    <strong>Geohash: {grid.geohash}</strong><br />
                                                    Suppliers: {grid.supplier_count}<br />
                                                    Avg Accuracy: ±{grid.avg_accuracy.toFixed(0)}m<br />
                                                    Last Updated: {new Date(grid.last_updated).toLocaleString()}
                                                </div>
                                            </Popup>
                                        </Rectangle>
                                    )
                                })}
                            </MapContainer>

                            {/* Legend */}
                            <div className="mt-4 flex gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-500 rounded"></div>
                                    <span className="text-sm">1-4 suppliers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-yellow-500 rounded"></div>
                                    <span className="text-sm">5-9 suppliers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-orange-500 rounded"></div>
                                    <span className="text-sm">10-19 suppliers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-red-600 rounded"></div>
                                    <span className="text-sm">20+ suppliers</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-96 flex items-center justify-center text-gray-500">
                            No active suppliers in the last 24 hours
                        </div>
                    )}
                </div>

                {/* Gap Analysis */}
                {grids.length > 0 && (
                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <h3 className="font-bold text-yellow-900 mb-3">📊 Coverage Analysis</h3>
                        <div className="space-y-2 text-sm text-yellow-800">
                            <p>
                                ✅ <strong>{grids.length}</strong> areas with active supplier coverage
                            </p>
                            <p>
                                📍 Areas with highest density may benefit from additional logistics support
                            </p>
                            <p>
                                ⚠️ Consider analyzing areas with zero coverage for expansion opportunities
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
