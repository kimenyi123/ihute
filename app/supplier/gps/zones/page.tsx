"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Clock, Zap } from "lucide-react"
import Link from "next/link"

type ActivityZone = {
    lat: number
    lng: number
    visit_count: number
    total_duration_minutes: number
    avg_accuracy: number
    zone_label: string
}

export default function ActivityZonesPage() {
    const router = useRouter()
    const { user, isAuthenticated, hasHydrated } = useAuthStore()

    const [zones, setZones] = useState<ActivityZone[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!hasHydrated) return
        if (!isAuthenticated || user?.role !== "supplier") {
            router.push("/login")
            return
        }
    }, [hasHydrated, isAuthenticated, user, router])

    useEffect(() => {
        if (!user?.ishyigaAccount) return
        fetchZones()
    }, [user])

    const fetchZones = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/gps/activity-zones", {
                credentials: "include"
            })

            if (res.ok) {
                const data = await res.json()
                setZones(data.zones || [])
            }
        } catch (error) {
            console.error("Failed to fetch activity zones:", error)
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
                                <h1 className="text-2xl font-bold text-slate-900">Activity Zones</h1>
                                <p className="text-sm text-slate-600">Where you spend most of your time</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Heatmap */}
                    <div className="lg:col-span-2">
                        <Card className="h-[600px]">
                            <CardHeader>
                                <CardTitle>Activity Heatmap</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[calc(100%-80px)]">
                                <div className="w-full h-full bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-lg flex items-center justify-center relative">
                                    {zones.length > 0 ? (
                                        <div className="text-center space-y-4">
                                            {/* Visual representation of heat zones */}
                                            <div className="relative w-64 h-64">
                                                <div className="absolute inset-0 bg-red-500/30 rounded-full blur-3xl"></div>
                                                <div className="absolute inset-8 bg-orange-500/40 rounded-full blur-2xl"></div>
                                                <div className="absolute inset-16 bg-yellow-500/50 rounded-full blur-xl"></div>
                                                <Zap className="h-16 w-16 text-yellow-600 relative z-10 mx-auto mt-20" />
                                            </div>
                                            <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg">
                                                <p className="text-slate-700 font-medium">{zones.length} Activity Zones Detected</p>
                                                <p className="text-sm text-slate-500 mt-1">Based on GPS clustering analysis</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Zap className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                            <p className="text-slate-500">No activity zones detected yet</p>
                                            <p className="text-sm text-slate-400 mt-2">Keep tracking to build patterns</p>
                                        </div>
                                    )}

                                    <div className="absolute bottom-4 left-4 bg-purple-500 text-white px-3 py-2 rounded text-xs">
                                        💡 Heatmap overlay will be shown here
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Zone List */}
                    <Card className="h-[600px] overflow-auto">
                        <CardHeader>
                            <CardTitle>Top Activity Zones</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {zones.length > 0 ? (
                                    zones.map((zone, idx) => (
                                        <div key={idx} className="p-4 bg-gradient-to-br from-white to-slate-50 border rounded-lg">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="font-semibold text-slate-900">{zone.zone_label || `Zone ${idx + 1}`}</div>
                                                    <div className="text-xs font-mono text-slate-500 mt-1">
                                                        {zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}
                                                    </div>
                                                </div>
                                                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-purple-600">#{idx + 1}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="flex items-center gap-1 text-xs text-slate-600">
                                                        <MapPin className="h-3 w-3" />
                                                        Visits
                                                    </div>
                                                    <div className="text-lg font-bold text-slate-900 mt-1">
                                                        {zone.visit_count}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1 text-xs text-slate-600">
                                                        <Clock className="h-3 w-3" />
                                                        Time
                                                    </div>
                                                    <div className="text-lg font-bold text-slate-900 mt-1">
                                                        {Math.round(zone.total_duration_minutes)}m
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <div className="text-xs text-slate-600">Avg Accuracy: {zone.avg_accuracy.toFixed(0)}m</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">No zones detected</p>
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
