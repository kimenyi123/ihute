"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Calendar, TrendingUp, Navigation } from "lucide-react"
import Link from "next/link"

type RoutePoint = {
    lat: number
    lng: number
    timestamp: string
    accuracy: number
}

export default function RouteHistoryPage() {
    const router = useRouter()
    const { user, isAuthenticated, hasHydrated } = useAuthStore()

    const [period, setPeriod] = useState<"today" | "week" | "month">("today")
    const [routeData, setRouteData] = useState<RoutePoint[]>([])
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState({
        totalDistance: 0,
        totalPoints: 0,
        avgAccuracy: 0,
        timeRange: ""
    })

    useEffect(() => {
        if (!hasHydrated) return
        if (!isAuthenticated || user?.role !== "supplier") {
            router.push("/login")
            return
        }
    }, [hasHydrated, isAuthenticated, user, router])

    useEffect(() => {
        if (!user?.ishyigaAccount) return
        fetchRouteHistory()
    }, [period, user])

    const fetchRouteHistory = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/gps/route-history?period=${period}`, {
                credentials: "include"
            })

            if (res.ok) {
                const data = await res.json()
                setRouteData(data.routes || [])
                setStats(data.stats || stats)
            }
        } catch (error) {
            console.error("Failed to fetch route history:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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
                                <h1 className="text-2xl font-bold text-slate-900">Route History</h1>
                                <p className="text-sm text-slate-600">Daily, weekly & monthly movement patterns</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                {/* Period Selector */}
                <div className="flex gap-2 mb-6">
                    <Button
                        variant={period === "today" ? "default" : "outline"}
                        onClick={() => setPeriod("today")}
                        className="gap-2"
                    >
                        <Calendar className="h-4 w-4" />
                        Today
                    </Button>
                    <Button
                        variant={period === "week" ? "default" : "outline"}
                        onClick={() => setPeriod("week")}
                        className="gap-2"
                    >
                        <Calendar className="h-4 w-4" />
                        This Week
                    </Button>
                    <Button
                        variant={period === "month" ? "default" : "outline"}
                        onClick={() => setPeriod("month")}
                        className="gap-2"
                    >
                        <Calendar className="h-4 w-4" />
                        This Month
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Total Distance</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {stats.totalDistance.toFixed(1)} km
                                    </div>
                                </div>
                                <Navigation className="h-10 w-10 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">GPS Points</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {stats.totalPoints.toLocaleString()}
                                    </div>
                                </div>
                                <MapPin className="h-10 w-10 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Avg Accuracy</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {stats.avgAccuracy.toFixed(0)}m
                                    </div>
                                </div>
                                <TrendingUp className="h-10 w-10 text-purple-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Time Range</div>
                                    <div className="text-lg font-bold text-slate-900 mt-1">
                                        {stats.timeRange || "N/A"}
                                    </div>
                                </div>
                                <Calendar className="h-10 w-10 text-orange-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Route Map */}
                    <div className="lg:col-span-2">
                        <Card className="h-[600px]">
                            <CardHeader>
                                <CardTitle>Route Visualization</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[calc(100%-80px)]">
                                <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 rounded-lg flex items-center justify-center relative">
                                    {routeData.length > 0 ? (
                                        <div className="text-center">
                                            <Navigation className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                                            <p className="text-slate-700 font-medium">{routeData.length} GPS points recorded</p>
                                            <p className="text-sm text-slate-500 mt-2">Route map will be rendered here</p>
                                        </div>
                                    ) : loading ? (
                                        <div className="text-center">
                                            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                                            <p className="text-slate-600">Loading route data...</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <MapPin className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                            <p className="text-slate-500">No route data for this period</p>
                                        </div>
                                    )}

                                    <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-3 py-2 rounded text-xs">
                                        💡 Route polyline will be drawn here using Leaflet
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Route Timeline */}
                    <Card className="h-[600px] overflow-auto">
                        <CardHeader>
                            <CardTitle>Route Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {routeData.length > 0 ? (
                                    routeData.slice(0, 20).map((point, idx) => (
                                        <div key={idx} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                                            <div className="flex-shrink-0">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <MapPin className="h-5 w-5 text-blue-600" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-900">
                                                    {new Date(point.timestamp).toLocaleTimeString()}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 font-mono">
                                                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    ±{point.accuracy.toFixed(0)}m
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">No GPS points recorded</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
