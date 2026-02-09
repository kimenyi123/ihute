"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radio, MapPin, Wifi, WifiOff, Clock, AlertTriangle, Gauge } from "lucide-react"
import { useEffect, useState } from "react"
import { getQueueStats } from "@/lib/gpsQueue"

interface GPSStatusCardProps {
    status: "idle" | "requesting" | "watching" | "denied" | "error"
    isOnline: boolean
    queueSize?: number
}

export function GPSStatusCard({ status, isOnline, queueSize = 0 }: GPSStatusCardProps) {
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [accuracy, setAccuracy] = useState<number | null>(null)
    const [queueStats, setQueueStats] = useState({ total: 0, pending: 0, synced: 0 })

    useEffect(() => {
        // Update last update time when GPS is watching
        if (status === "watching") {
            setLastUpdate(new Date())
        }
    }, [status])

    useEffect(() => {
        // Fetch queue stats
        getQueueStats().then(setQueueStats)
    }, [queueSize])

    const getStatusColor = () => {
        switch (status) {
            case "watching": return "text-green-600 bg-green-50"
            case "requesting": return "text-yellow-600 bg-yellow-50"
            case "denied": return "text-red-600 bg-red-50"
            case "error": return "text-red-600 bg-red-50"
            default: return "text-slate-600 bg-slate-50"
        }
    }

    const getStatusText = () => {
        switch (status) {
            case "watching": return "GPS Active"
            case "requesting": return "Requesting Permission..."
            case "denied": return "GPS Permission Denied"
            case "error": return "GPS Error"
            default: return "GPS Idle"
        }
    }

    const getAccuracyLevel = (acc: number | null) => {
        if (!acc) return { label: "Unknown", color: "text-slate-500" }
        if (acc <= 20) return { label: "Excellent", color: "text-green-600" }
        if (acc <= 50) return { label: "Good", color: "text-blue-600" }
        if (acc <= 100) return { label: "Fair", color: "text-yellow-600" }
        return { label: "Poor", color: "text-red-600" }
    }

    const accLevel = getAccuracyLevel(accuracy)

    return (
        <Card className="bg-white shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    GPS Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor()}`}>
                    {status === "watching" && <Radio className="h-4 w-4 animate-pulse" />}
                    {status === "denied" && <AlertTriangle className="h-4 w-4" />}
                    {status === "requesting" && (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className="font-medium text-sm">{getStatusText()}</span>
                </div>

                {/* Connection Status */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Connection</span>
                    <div className="flex items-center gap-2">
                        {isOnline ? (
                            <>
                                <Wifi className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-600">Online</span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="h-4 w-4 text-red-600" />
                                <span className="text-sm font-medium text-red-600">Offline</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Accuracy */}
                {accuracy && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Accuracy</span>
                        <div className="flex items-center gap-2">
                            <Gauge className={`h-4 w-4 ${accLevel.color}`} />
                            <span className={`text-sm font-medium ${accLevel.color}`}>
                                {accuracy.toFixed(0)}m ({accLevel.label})
                            </span>
                        </div>
                    </div>
                )}

                {/* Last Update */}
                {lastUpdate && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Last Update</span>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-700">
                                {lastUpdate.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Queue Status */}
                {queueStats.pending > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-900">
                                {queueStats.pending} update{queueStats.pending !== 1 ? 's' : ''} pending sync
                            </span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                            Will sync when connection is restored
                        </p>
                    </div>
                )}

                {/* Tips */}
                {status === "watching" && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-900">
                            💡 <strong>Tip:</strong> Keep this tab open for continuous tracking. GPS updates are sent automatically while you're logged in.
                        </p>
                    </div>
                )}

                {status === "denied" && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-900">
                            ⚠️ GPS permission is required for location tracking. Please enable location access in your browser settings.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
