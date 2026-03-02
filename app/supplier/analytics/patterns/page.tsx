'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface PatternData {
    common_routes: Array<{
        start_zone: string
        end_zone: string
        frequency: number
        avg_duration_min: number
    }>
    peak_hours: Array<{
        hour: number
        activity_count: number
        avg_speed_ms: number
    }>
}

export default function MovementPatternsPage() {
    const [data, setData] = useState<PatternData | null>(null)
    const [loading, setLoading] = useState(false)
    const [daysBack, setDaysBack] = useState(30)

    useEffect(() => {
        fetchPatterns()
    }, [daysBack])

    const fetchPatterns = async () => {
        setLoading(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_JAVA_BACKEND_BASE}/RoutePatternServlet?daysBack=${daysBack}`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch (error) {
            console.error('Error fetching patterns:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Movement Patterns</h1>

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
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <div className="text-xl">Analyzing patterns...</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Peak Hours Chart */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-bold mb-4">Activity by Hour</h2>

                            {data && data.peak_hours.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={data.peak_hours}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="hour"
                                            label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                                        />
                                        <YAxis label={{ value: 'Activity Count', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip />
                                        <Bar dataKey="activity_count" fill="#3b82f6" name="Activity Count" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-gray-500 text-center py-8">No activity data available</div>
                            )}
                        </div>

                        {/* Speed by Hour */}
                        {data && data.peak_hours.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold mb-4">Average Speed by Hour</h2>

                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={data.peak_hours}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="hour" label={{ value: 'Hour', position: 'insideBottom', offset: -5 }} />
                                        <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip formatter={(value: number) => (value * 3.6).toFixed(1)} />
                                        <Line
                                            type="monotone"
                                            dataKey="avg_speed_ms"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            name="Avg Speed (m/s)"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Common Routes */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-bold mb-4">Most Frequent Routes</h2>

                            {data && data.common_routes.length > 0 ? (
                                <div className="space-y-3">
                                    {data.common_routes.map((route, index) => (
                                        <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium">
                                                        {route.start_zone} → {route.end_zone}
                                                    </div>
                                                    <div className="text-sm text-gray-600 mt-1">
                                                        Avg Duration: {route.avg_duration_min} minutes
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-blue-600">{route.frequency}</div>
                                                    <div className="text-xs text-gray-500">trips</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-8">
                                    No common routes detected. More data needed.
                                </div>
                            )}
                        </div>

                        {/* Insights */}
                        {data && data.peak_hours.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <h3 className="font-bold text-blue-900 mb-3">💡 Insights</h3>
                                <ul className="space-y-2 text-sm text-blue-800">
                                    {(() => {
                                        const peakHour = data.peak_hours.reduce((max, h) =>
                                            h.activity_count > max.activity_count ? h : max
                                        )
                                        const avgSpeed = data.peak_hours.reduce((sum, h) => sum + h.avg_speed_ms, 0) / data.peak_hours.length

                                        return (
                                            <>
                                                <li>📊 Peak activity hour: <strong>{peakHour.hour}:00</strong> with {peakHour.activity_count} updates</li>
                                                <li>🚶 Average movement speed: <strong>{(avgSpeed * 3.6).toFixed(1)} km/h</strong></li>
                                                {data.common_routes.length > 0 && (
                                                    <li>🔁 Most frequent route: <strong>{data.common_routes[0].start_zone} → {data.common_routes[0].end_zone}</strong> ({data.common_routes[0].frequency} times)</li>
                                                )}
                                            </>
                                        )
                                    })()}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
