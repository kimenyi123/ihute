'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const ServiceAreaMap = dynamic(() => import('./ServiceAreaMap'), { ssr: false })

interface ServiceAreaData {
    center_lat: number
    center_lng: number
    coverage_radius_km: number
    total_deliveries: number
    suggested_radius_km: number
    expansion_areas: Array<{
        geohash: string
        lat: number
        lng: number
        demand_score: number
    }>
}

export default function ServiceAreaPage() {
    const [data, setData] = useState<ServiceAreaData | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchServiceArea()
    }, [])

    const fetchServiceArea = async () => {
        setLoading(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE}/ServiceAreaServlet`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch (error) {
            console.error('Error fetching service area:', error)
        } finally {
            setLoading(false)
        }
    }

    const coverageData = data ? [
        { name: 'Covered Area', value: data.coverage_radius_km, color: '#10b981' },
        { name: 'Suggested Expansion', value: Math.max(0, data.suggested_radius_km - data.coverage_radius_km), color: '#f59e0b' }
    ] : []

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Service Area Optimization</h1>

                {loading ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="text-xl">Analyzing service area...</div>
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="text-sm text-gray-600">Current Coverage</div>
                                <div className="text-3xl font-bold text-green-600">{data.coverage_radius_km.toFixed(1)} km</div>
                                <div className="text-xs text-gray-500 mt-1">Radius</div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="text-sm text-gray-600">Suggested Radius</div>
                                <div className="text-3xl font-bold text-orange-600">{data.suggested_radius_km.toFixed(1)} km</div>
                                <div className="text-xs text-gray-500 mt-1">For optimal coverage</div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="text-sm text-gray-600">Total Deliveries</div>
                                <div className="text-3xl font-bold text-blue-600">{data.total_deliveries}</div>
                                <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
                                <h2 className="font-bold text-lg mb-4">Coverage Map</h2>
                                <ServiceAreaMap
                                    center_lat={data.center_lat}
                                    center_lng={data.center_lng}
                                    coverage_radius_km={data.coverage_radius_km}
                                    suggested_radius_km={data.suggested_radius_km}
                                    expansion_areas={data.expansion_areas}
                                />
                                <div className="mt-4 flex gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-green-500 border-dashed rounded"></div>
                                        <span>Current Coverage</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-orange-500 rounded"></div>
                                        <span>Suggested Expansion</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                        <span>High Demand Areas</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="font-bold mb-4">Coverage Analysis</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie data={coverageData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label>
                                                {coverageData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-4 space-y-2 text-sm">
                                        {coverageData.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                                                <span>{item.name}: {item.value.toFixed(1)} km</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="font-bold mb-3">💡 Recommendations</h3>
                                    <div className="space-y-3 text-sm">
                                        {data.suggested_radius_km > data.coverage_radius_km ? (
                                            <div className="bg-orange-50 border-l-4 border-orange-500 p-3">
                                                <div className="font-medium text-orange-900">Expand Service Area</div>
                                                <div className="text-orange-700 mt-1">
                                                    Consider expanding by {(data.suggested_radius_km - data.coverage_radius_km).toFixed(1)} km to capture more opportunities
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-green-50 border-l-4 border-green-500 p-3">
                                                <div className="font-medium text-green-900">✅ Optimal Coverage</div>
                                                <div className="text-green-700 mt-1">Your current service area is well-optimized</div>
                                            </div>
                                        )}
                                        {data.expansion_areas.length > 0 && (
                                            <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
                                                <div className="font-medium text-blue-900">High Demand Areas</div>
                                                <div className="text-blue-700 mt-1">{data.expansion_areas.length} area(s) with high potential</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow p-6">
                                    <h3 className="font-bold mb-3">Efficiency</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Coverage</span>
                                                <span className="font-medium">{Math.round((data.coverage_radius_km / data.suggested_radius_km) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (data.coverage_radius_km / data.suggested_radius_km) * 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                        No service area data available
                    </div>
                )}
            </div>
        </div>
    )
}
