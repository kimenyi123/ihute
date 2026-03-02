"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield, Clock, MapPin, Bell, Save, Zap } from "lucide-react"
import Link from "next/link"

export default function GPSSettingsPage() {
    const router = useRouter()
    const { user, isAuthenticated, hasHydrated } = useAuthStore()

    // Privacy Controls
    const [trackingEnabled, setTrackingEnabled] = useState(true)
    const [shareWithCustomers, setShareWithCustomers] = useState(false)
    const [dataRetentionDays, setDataRetentionDays] = useState(90)

    // Schedule
    const [scheduleEnabled, setScheduleEnabled] = useState(false)
    const [startTime, setStartTime] = useState("08:00")
    const [endTime, setEndTime] = useState("18:00")
    const [workDays, setWorkDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"])

    // Geofence
    const [geofenceEnabled, setGeofenceEnabled] = useState(false)
    const [geofenceLat, setGeofenceLat] = useState("")
    const [geofenceLng, setGeofenceLng] = useState("")
    const [geofenceRadius, setGeofenceRadius] = useState(5)
    const [notifyOnExit, setNotifyOnExit] = useState(true)
    const [notifyOnEntry, setNotifyOnEntry] = useState(false)

    // Battery
    const [batteryMode, setBatteryMode] = useState<"balanced" | "accurate" | "efficient">("balanced")

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!hasHydrated) return
        if (!isAuthenticated || user?.role !== "supplier") {
            router.push("/login")
            return
        }
    }, [hasHydrated, isAuthenticated, user, router])

    const toggleWorkDay = (day: string) => {
        setWorkDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        )
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/gps/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trackingEnabled,
                    shareWithCustomers,
                    dataRetentionDays,
                    schedule: {
                        enabled: scheduleEnabled,
                        startTime,
                        endTime,
                        workDays
                    },
                    geofence: {
                        enabled: geofenceEnabled,
                        lat: parseFloat(geofenceLat),
                        lng: parseFloat(geofenceLng),
                        radius: geofenceRadius,
                        notifyOnExit,
                        notifyOnEntry
                    },
                    batteryMode
                }),
                credentials: "include"
            })

            if (res.ok) {
                alert("Settings saved successfully!")
            } else {
                alert("Failed to save settings")
            }
        } catch (error) {
            alert("Error saving settings")
        } finally {
            setSaving(false)
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
                                <h1 className="text-2xl font-bold text-slate-900">GPS Settings</h1>
                                <p className="text-sm text-slate-600">Privacy controls & configuration</p>
                            </div>
                        </div>
                        <Button onClick={saveSettings} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
                            <Save className="h-4 w-4" />
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8 max-w-4xl">
                <div className="space-y-6">
                    {/* Privacy Controls */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-blue-600" />
                                <CardTitle>Privacy Controls</CardTitle>
                            </div>
                            <CardDescription>Manage your location data and sharing preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable Tracking */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">GPS Tracking</div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        Enable or disable location tracking completely
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTrackingEnabled(!trackingEnabled)}
                                    className={`relative w-14 h-8 rounded-full transition-colors ${trackingEnabled ? "bg-green-500" : "bg-slate-300"
                                        }`}
                                >
                                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${trackingEnabled ? "translate-x-6" : ""
                                        }`} />
                                </button>
                            </div>

                            {/* Share with Customers */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Share with Customers</div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        Allow customers to see your real-time location during deliveries
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShareWithCustomers(!shareWithCustomers)}
                                    className={`relative w-14 h-8 rounded-full transition-colors ${shareWithCustomers ? "bg-blue-500" : "bg-slate-300"
                                        }`}
                                >
                                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${shareWithCustomers ? "translate-x-6" : ""
                                        }`} />
                                </button>
                            </div>

                            {/* Data Retention */}
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="font-medium text-slate-900 mb-3">Data Retention</div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="30"
                                        max="365"
                                        step="30"
                                        value={dataRetentionDays}
                                        onChange={(e) => setDataRetentionDays(parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <div className="text-sm font-medium text-slate-700 min-w-[100px]">
                                        {dataRetentionDays} days
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 mt-2">
                                    GPS history older than {dataRetentionDays} days will be automatically deleted
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location Schedule */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-purple-600" />
                                <CardTitle>Location Sharing Schedule</CardTitle>
                            </div>
                            <CardDescription>Set business hours for automatic tracking</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Schedule Enabled</div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        Only track during business hours
                                    </div>
                                </div>
                                <button
                                    onClick={() => setScheduleEnabled(!scheduleEnabled)}
                                    className={`relative w-14 h-8 rounded-full transition-colors ${scheduleEnabled ? "bg-purple-500" : "bg-slate-300"
                                        }`}
                                >
                                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${scheduleEnabled ? "translate-x-6" : ""
                                        }`} />
                                </button>
                            </div>

                            {scheduleEnabled && (
                                <>
                                    {/* Time Range */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Start Time</label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full mt-2 px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">End Time</label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full mt-2 px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    {/* Work Days */}
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-3 block">Work Days</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                                <button
                                                    key={day}
                                                    onClick={() => toggleWorkDay(day)}
                                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${workDays.includes(day)
                                                            ? "bg-purple-500 text-white"
                                                            : "bg-slate-200 text-slate-600"
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Geofence Alerts */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-orange-600" />
                                <CardTitle>Geofence Alerts</CardTitle>
                            </div>
                            <CardDescription>Get notified when entering/leaving zones</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Geofence Enabled</div>
                                    <div className="text-sm text-slate-600 mt-1">
                                        Alert when moving outside service area
                                    </div>
                                </div>
                                <button
                                    onClick={() => setGeofenceEnabled(!geofenceEnabled)}
                                    className={`relative w-14 h-8 rounded-full transition-colors ${geofenceEnabled ? "bg-orange-500" : "bg-slate-300"
                                        }`}
                                >
                                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${geofenceEnabled ? "translate-x-6" : ""
                                        }`} />
                                </button>
                            </div>

                            {geofenceEnabled && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Center Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={geofenceLat}
                                                onChange={(e) => setGeofenceLat(e.target.value)}
                                                placeholder="-1.95408"
                                                className="w-full mt-2 px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Center Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={geofenceLng}
                                                onChange={(e) => setGeofenceLng(e.target.value)}
                                                placeholder="30.099339"
                                                className="w-full mt-2 px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-3 block">
                                            Geofence Radius: {geofenceRadius} km
                                        </label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="50"
                                            value={geofenceRadius}
                                            onChange={(e) => setGeofenceRadius(parseFloat(e.target.value))}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="notify-exit"
                                                checked={notifyOnExit}
                                                onChange={(e) => setNotifyOnExit(e.target.checked)}
                                                className="w-4 h-4 text-orange-500"
                                            />
                                            <label htmlFor="notify-exit" className="text-sm text-slate-700">
                                                Notify when exiting geofence
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="notify-entry"
                                                checked={notifyOnEntry}
                                                onChange={(e) => setNotifyOnEntry(e.target.checked)}
                                                className="w-4 h-4 text-orange-500"
                                            />
                                            <label htmlFor="notify-entry" className="text-sm text-slate-700">
                                                Notify when entering geofence
                                            </label>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Battery Usage */}
                    <Card>
                        <CardHeader className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-600" />
                            <CardTitle>Battery Usage</CardTitle>
                            <CardDescription>Optimize GPS tracking for battery life</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { value: "efficient", label: "Efficient", desc: "Low battery use, less accurate" },
                                    { value: "balanced", label: "Balanced", desc: "Good balance (Recommended)" },
                                    { value: "accurate", label: "Accurate", desc: "Best accuracy, higher battery use" }
                                ].map(mode => (
                                    <button
                                        key={mode.value}
                                        onClick={() => setBatteryMode(mode.value as any)}
                                        className={`p-4 rounded-lg border-2 transition-all ${batteryMode === mode.value
                                                ? "border-yellow-500 bg-yellow-50"
                                                : "border-slate-200 bg-white hover:border-yellow-300"
                                            }`}
                                    >
                                        <div className="font-medium text-slate-900">{mode.label}</div>
                                        <div className="text-xs text-slate-600 mt-2">{mode.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
