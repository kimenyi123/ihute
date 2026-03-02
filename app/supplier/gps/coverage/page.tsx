"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, MapPin, TrendingUp, Circle } from "lucide-react"
import Link from "next/link"

export default function CoverageAreaPage() {
    const router = useRouter()
    const { user, isAuthenticated, hasHydrated } = useAuthStore()

    const [coverage, setCoverage] = useState({
        totalArea: 0,
        uniqueLocations: 0,
        coverageRadius: 0,
        centerLat: 0,
        centerLng: 0
    })
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
        fetchCoverage()
    }, [user])

    const fetchCoverage = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/gps/coverage-area", {
                credentials: "include"
            })

            if (res.ok) {
                const data = await res.json()
                setCoverage(data.coverage || coverage)
            }
        } catch (error) {
            console.error("Failed to fetch coverage:", error)
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
                                <h1 className="text-2xl font-bold text-slate-900">Coverage Area</h1>
                                <p className="text-sm text-slate-600">Service area visualization</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Total Area</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {coverage.totalArea.toFixed(1)} km²
                                    </div>
                                </div>
                                <Map className="h-10 w-10 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Locations</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {coverage.uniqueLocations}
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
                                    <div className="text-sm text-slate-600">Coverage Radius</div>
                                    <div className="text-2xl font-bold text-slate-900 mt-1">
                                        {coverage.coverageRadius.toFixed(1)} km
                                    </div>
                                </div>
                                <Circle className="h-10 w-10 text-purple-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-slate-600">Growth</div>
                                    <div className="text-2xl font-bold text-green-600 mt-1">
                                        +12%
                                    </div>
                                </div>
                                <TrendingUp className="h-10 w-10 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Coverage Map */}
                <Card className="h-[600px]">
                    <CardHeader>
                        <CardTitle>Service Area Map</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[calc(100%-80px)]">
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 rounded-lg flex items-center justify-center relative">
                            {coverage.uniqueLocations > 0 ? (
                                <div className="text-center space-y-4">
                                    {/* Coverage Circle Visualization */}
                                    <div className="relative w-80 h-80">
                                        <div className="absolute inset-0 border-4 border-blue-300 rounded-full opacity-30"></div>
                                        <div className="absolute inset-12 border-4 border-blue-400 rounded-full opacity-50"></div>
                                        <div className="absolute inset-24 border-4 border-blue-500 rounded-full opacity-70"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Map className="h-20 w-20 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg">
                                        <p className="text-slate-700 font-medium">Coverage Center</p>
                                        <p className="text-sm font-mono text-slate-600 mt-1">
                                            {coverage.centerLat.toFixed(5)}, {coverage.centerLng.toFixed(5)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Map className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500">No coverage data yet</p>
                                    <p className="text-sm text-slate-400 mt-2">Start tracking to build coverage map</p>
                                </div>
                            )}

                            <div className="absolute bottom-4 left-4 bg-orange-500 text-white px-3 py-2 rounded text-xs">
                                💡 Coverage polygon will be drawn here
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
