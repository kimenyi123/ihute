'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalyticsData {
    totalRatings: number
    averageRating: number
    distribution: { [key: string]: number }
    submissionsOverTime: Array<{ date: string; count: number }>
    topRatedSuppliers: Array<{ name: string; rating: number; count: number }>
    flaggedCount: number
    sellerResponseRate: number
}

export default function RatingAnalyticsCharts({ period = '30days' }: { period?: string }) {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [period])

    const fetchAnalytics = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/admin/ratings?action=getRatingAnalytics&period=${period}`)
            const data = await res.json()

            if (data.ok) {
                setAnalytics(data.analytics)
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-8">Loading analytics...</div>
    }

    if (!analytics) {
        return <div className="p-4 text-red-500">Failed to load analytics</div>
    }

    // Prepare distribution data for bar chart
    const distributionData = Object.entries(analytics.distribution || {}).map(([stars, count]) => ({
        stars: `${stars} ⭐`,
        count: count as number,
    }))

    return (
        <div className="space-y-6">
            {/* Submissions Over Time - Line Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Rating Submissions Over Time</CardTitle>
                    <CardDescription>Track how many ratings are being submitted</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.submissionsOverTime || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="count" stroke="#8884d8" name="Submissions" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Rating Distribution - Bar Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Rating Distribution</CardTitle>
                    <CardDescription>Breakdown of ratings by star count</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={distributionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="stars" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#fbbf24" name="Number of Ratings" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Top Rated Suppliers - Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle>🏆 Top Rated Suppliers</CardTitle>
                    <CardDescription>Suppliers with the highest average ratings</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {(analytics.topRatedSuppliers || []).map((supplier, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                                    <div>
                                        <div className="font-semibold">{supplier.name}</div>
                                        <div className="text-sm text-gray-500">{supplier.count} ratings</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{'⭐'.repeat(Math.round(supplier.rating))}</span>
                                    <span className="font-bold text-lg">{supplier.rating.toFixed(1)}</span>
                                </div>
                            </div>
                        ))}
                        {(analytics.topRatedSuppliers || []).length === 0 && (
                            <div className="text-center text-gray-500 py-8">No data available</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Response Rate & Flags */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>💬 Seller Response Rate</CardTitle>
                        <CardDescription>Percentage of ratings with seller responses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center">
                            <div className="text-6xl font-bold text-blue-600">
                                {analytics.sellerResponseRate.toFixed(1)}%
                            </div>
                        </div>
                        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all"
                                style={{ width: `${analytics.sellerResponseRate}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>🚩 Flagged Ratings</CardTitle>
                        <CardDescription>Number of ratings flagged for review</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center">
                            <div className={`text-6xl font-bold ${analytics.flaggedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {analytics.flaggedCount}
                            </div>
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-500">
                            {analytics.flaggedCount > 0 ? 'Needs moderation attention' : 'All clear!'}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
