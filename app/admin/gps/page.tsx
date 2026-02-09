"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import dynamic from 'next/dynamic'
import { MapPin, AlertCircle, CheckCircle, RefreshCw, Download, Upload, Search, ExternalLink, Copy, Map } from "lucide-react"

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

// Helper: Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Helper: Get GPS quality badge
const getQualityBadge = (accuracy: number | null) => {
    if (!accuracy) return { color: "bg-red-100 text-red-800", label: "Missing", icon: "🔴" }
    if (accuracy < 10) return { color: "bg-green-100 text-green-800", label: "High", icon: "🟢" }
    if (accuracy < 50) return { color: "bg-yellow-100 text-yellow-800", label: "Medium", icon: "🟡" }
    return { color: "bg-red-100 text-red-800", label: "Low", icon: "🔴" }
}

// Helper: Copy to clipboard
const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
        alert(`✅ Copied ${label}:\n${text}`)
    }).catch(() => {
        alert("❌ Failed to copy")
    })
}

interface GPSIssue {
    ISHYIGA_ACCOUNT: string
    nickname: string
    supplier_latitude: number | null
    supplier_longitude: number | null
    gps_last_updated: string | null
    gps_accuracy: number | null
    status: string
    days_since_update: number | null
}

interface GPSStats {
    total_sellers: number
    missing_gps: number
    outdated_gps: number
    low_accuracy: number
    avg_accuracy_meters: number
    duplicate_locations?: number
}

interface GPSConfig {
    globalGPSEnabled: boolean
    maxUpdatesPerWeek: number
    businessHoursStart: string
    businessHoursEnd: string
    minIntervalMinutes: number
    maxAccuracyMeters: number
    updatedBy: string
    updatedAt: string
}

export default function GPSManagementPage() {
    const [issues, setIssues] = useState<GPSIssue[]>([])
    const [stats, setStats] = useState<GPSStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>("ALL")
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedSupplier, setSelectedSupplier] = useState<GPSIssue | null>(null)
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set())
    const [updating, setUpdating] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20
    const [sortBy, setSortBy] = useState<"default" | "distance">("default")
    const [showMapView, setShowMapView] = useState(false)
    
    // GPS Configuration State
    const [gpsConfig, setGpsConfig] = useState<GPSConfig | null>(null)
    const [configLoading, setConfigLoading] = useState(true)
    const [configSaving, setConfigSaving] = useState(false)
    const [showConfigPanel, setShowConfigPanel] = useState(true)

    // Kigali center coordinates for distance calculation
    const KIGALI_CENTER = { lat: -1.9536, lng: 30.0606 }

    // Fix Leaflet default marker icon issue in Next.js
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet')
            delete (L.Icon.Default.prototype as any)._getIconUrl
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            })
        }
    }, [])

    // Fetch GPS issues and config
    useEffect(() => {
        fetchGPSIssues()
        fetchGPSStats()
        fetchGPSConfig()
    }, [])

    // Calculate filtered issues and pagination early (needed by useEffect)
    const getFilteredIssues = () => {
        let filtered = issues

        if (filterStatus !== "ALL") {
            filtered = filtered.filter((issue) => issue.status === filterStatus)
        }

        if (searchTerm) {
            filtered = filtered.filter(
                (issue) =>
                    issue.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    issue.ISHYIGA_ACCOUNT?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        return filtered
    }

    const filteredIssues = useMemo(() => {
        let filtered = getFilteredIssues()

        // Add distance calculation to each issue
        const withDistance = filtered.map(issue => ({
            ...issue,
            distanceFromKigali: issue.supplier_latitude && issue.supplier_longitude
                ? calculateDistance(KIGALI_CENTER.lat, KIGALI_CENTER.lng, issue.supplier_latitude, issue.supplier_longitude)
                : 999999 // Large number for missing GPS
        }))

        // Sort by distance if requested
        if (sortBy === "distance") {
            withDistance.sort((a, b) => a.distanceFromKigali - b.distanceFromKigali)
        }

        return withDistance
    }, [issues, filterStatus, searchTerm, sortBy])

    // Pagination logic
    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedIssues = filteredIssues.slice(startIndex, endIndex)

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [filterStatus, searchTerm])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F: Focus search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault()
                document.getElementById('search-input')?.focus()
            }
            // Ctrl+E: Export CSV
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault()
                handleExportCSV()
            }
            // Escape: Close modal
            if (e.key === 'Escape' && selectedSupplier) {
                setSelectedSupplier(null)
            }
            // Arrow Left: Previous page
            if (e.key === 'ArrowLeft' && !selectedSupplier && currentPage > 1) {
                handlePrevPage()
            }
            // Arrow Right: Next page
            if (e.key === 'ArrowRight' && !selectedSupplier && currentPage < totalPages) {
                handleNextPage()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedSupplier, currentPage, totalPages])

    const fetchGPSIssues = async () => {
        setLoading(true)
        try {
            const response = await fetch("/api/admin/gps-audit")
            const data = await response.json()
            setIssues(data.issues || [])
        } catch (error) {
            console.error("Failed to fetch GPS issues:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchGPSStats = async () => {
        try {
            const response = await fetch("/api/admin/gps-stats")
            const data = await response.json()
            setStats(data)
        } catch (error) {
            console.error("Failed to fetch GPS stats:", error)
        }
    }

    const fetchGPSConfig = async () => {
        setConfigLoading(true)
        try {
            const response = await fetch("/api/admin/gps-config?action=getConfig")
            const data = await response.json()
            if (data.ok && data.config) {
                setGpsConfig(data.config)
            }
        } catch (error) {
            console.error("Failed to fetch GPS config:", error)
        } finally {
            setConfigLoading(false)
        }
    }

    const handleSaveGPSConfig = async () => {
        if (!gpsConfig) return

        setConfigSaving(true)
        try {
            const response = await fetch("/api/admin/gps-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "updateConfig",
                    ...gpsConfig,
                    updatedBy: "admin" // TODO: Get from session
                })
            })

            const data = await response.json()
            if (data.ok) {
                alert("✅ GPS configuration saved successfully!")
                fetchGPSConfig()
            } else {
                alert("❌ Failed to save GPS configuration: " + data.error)
            }
        } catch (error) {
            console.error("Failed to save GPS config:", error)
            alert("❌ Error saving GPS configuration")
        } finally {
            setConfigSaving(false)
        }
    }

    const handleSetSellerOverride = async (sellerId: string, override: string) => {
        try {
            const response = await fetch("/api/admin/gps-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "setSellerOverride",
                    sellerId,
                    gpsOverride: override
                })
            })

            const data = await response.json()
            if (data.ok) {
                alert(`✅ GPS override set to ${override} for seller ${sellerId}`)
                setSelectedSupplier(null)
                fetchGPSIssues()
            } else {
                alert("❌ Failed to set override: " + data.error)
            }
        } catch (error) {
            console.error("Failed to set seller override:", error)
            alert("❌ Error setting seller override")
        }
    }

    const handleToggleSupplier = (supplierId: string) => {
        setSelectedSuppliers(prev => {
            const newSet = new Set(prev)
            if (newSet.has(supplierId)) {
                newSet.delete(supplierId)
            } else {
                newSet.add(supplierId)
            }
            return newSet
        })
    }

    const handleToggleAll = () => {
        const filteredIssues = getFilteredIssues()
        if (selectedSuppliers.size === filteredIssues.length) {
            setSelectedSuppliers(new Set())
        } else {
            setSelectedSuppliers(new Set(filteredIssues.map(issue => issue.ISHYIGA_ACCOUNT)))
        }
    }

    const handleBulkFixSwapped = async () => {
        const selectedOnly = selectedSuppliers.size > 0
        const count = selectedOnly ? selectedSuppliers.size : "all"

        if (!confirm(`Fix swapped coordinates for ${count} supplier(s)? This will backup and update the database.`)) {
            return
        }

        setUpdating(true)
        try {
            const response = await fetch("/api/admin/gps-bulk-fix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "fix_swapped",
                    selectedIds: selectedOnly ? Array.from(selectedSuppliers) : null
                }),
            })

            const result = await response.json()
            alert(`✅ Fixed ${result.updated} swapped coordinates`)
            setSelectedSuppliers(new Set())
            fetchGPSIssues()
            fetchGPSStats()
        } catch (error) {
            alert("❌ Failed to fix coordinates")
        } finally {
            setUpdating(false)
        }
    }

    const handleSetDefaultKigali = async () => {
        const selectedOnly = selectedSuppliers.size > 0
        const count = selectedOnly ? selectedSuppliers.size : "all"

        if (!confirm(`Set Kigali coordinates for ${count} supplier(s) with missing GPS?`)) {
            return
        }

        setUpdating(true)
        try {
            const response = await fetch("/api/admin/gps-bulk-fix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "set_default_kigali",
                    selectedIds: selectedOnly ? Array.from(selectedSuppliers) : null
                }),
            })

            const result = await response.json()
            alert(`✅ Set default coordinates for ${result.updated} suppliers`)
            setSelectedSuppliers(new Set())
            fetchGPSIssues()
            fetchGPSStats()
        } catch (error) {
            alert("❌ Failed to set defaults")
        } finally {
            setUpdating(false)
        }
    }

    const handleUpdateSupplier = async (supplierId: string, lat: number, lng: number) => {
        setUpdating(true)
        try {
            const response = await fetch("/api/admin/gps-update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ supplierId, latitude: lat, longitude: lng }),
            })

            if (response.ok) {
                alert("✅ Coordinates updated")
                setSelectedSupplier(null)
                fetchGPSIssues()
                fetchGPSStats()
            } else {
                alert("❌ Failed to update")
            }
        } catch (error) {
            alert("❌ Error updating coordinates")
        } finally {
            setUpdating(false)
        }
    }

    const handleExportCSV = () => {
        const filteredIssues = getFilteredIssues()
        const csv = [
            ["ISHYIGA_ACCOUNT", "nickname", "latitude", "longitude", "distance_from_kigali_km", "gps_quality", "accuracy_m", "status", "days_old"].join(","),
            ...filteredIssues.map((issue) => {
                const distance = issue.supplier_latitude && issue.supplier_longitude
                    ? calculateDistance(KIGALI_CENTER.lat, KIGALI_CENTER.lng, issue.supplier_latitude, issue.supplier_longitude).toFixed(2)
                    : "N/A"
                const quality = getQualityBadge(issue.gps_accuracy).label

                return [
                    issue.ISHYIGA_ACCOUNT,
                    `"${issue.nickname}"`,
                    issue.supplier_latitude || "",
                    issue.supplier_longitude || "",
                    distance,
                    quality,
                    issue.gps_accuracy || "",
                    issue.status,
                    issue.days_since_update || "",
                ].join(",")
            }),
        ].join("\n")

        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `gps_issues_${new Date().toISOString().split("T")[0]}.csv`
        a.click()
    }

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string
                const lines = text.split("\n")

                // Skip header
                const dataLines = lines.slice(1).filter(line => line.trim())

                const updates: Array<{ supplierId: string; latitude: number; longitude: number }> = []

                for (const line of dataLines) {
                    const [supplierId, nickname, lat, lng] = line.split(",").map(v => v.trim().replace(/"/g, ""))

                    const latitude = parseFloat(lat)
                    const longitude = parseFloat(lng)

                    // Validate
                    if (supplierId && !isNaN(latitude) && !isNaN(longitude)) {
                        if (latitude >= -2.9 && latitude <= -1.0 && longitude >= 28.8 && longitude <= 30.9) {
                            updates.push({ supplierId, latitude, longitude })
                        }
                    }
                }

                if (updates.length === 0) {
                    alert("❌ No valid updates found in file")
                    return
                }

                if (!confirm(`Upload ${updates.length} coordinate updates?`)) {
                    return
                }

                setUpdating(true)

                const response = await fetch("/api/admin/gps-bulk-upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates }),
                })

                const result = await response.json()

                if (response.ok) {
                    alert(`✅ Updated ${result.updated} suppliers successfully!`)
                    fetchGPSIssues()
                    fetchGPSStats()
                } else {
                    alert(`❌ Error: ${result.error}`)
                }
            } catch (error) {
                console.error("Upload error:", error)
                alert("❌ Failed to process file")
            } finally {
                setUpdating(false)
                // Reset file input
                event.target.value = ""
            }
        }

        reader.readAsText(file)
    }

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            NO_GPS: "bg-red-100 text-red-800",
            SWAPPED: "bg-orange-100 text-orange-800",
            OUT_OF_RANGE_LAT: "bg-purple-100 text-purple-800",
            OUT_OF_RANGE_LNG: "bg-purple-100 text-purple-800",
            OUTDATED: "bg-yellow-100 text-yellow-800",
            LOW_ACCURACY: "bg-blue-100 text-blue-800",
            OK: "bg-green-100 text-green-800",
        }
        return colors[status] || "bg-gray-100 text-gray-800"
    }

    const getStatusIcon = (status: string) => {
        if (status === "OK") return <CheckCircle className="h-4 w-4" />
        return <AlertCircle className="h-4 w-4" />
    }

    return (
        <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-4 md:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <MapPin className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                    <span className="hidden sm:inline">GPS Coordinates Management</span>
                    <span className="sm:hidden">GPS Management</span>
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-2">Audit and fix supplier GPS coordinates</p>
            </div>

            {/* GPS Configuration Panel */}
            <div className="bg-white rounded-lg border shadow-sm mb-4 md:mb-6">
                <div 
                    className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setShowConfigPanel(!showConfigPanel)}
                >
                    <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${gpsConfig?.globalGPSEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <h2 className="text-lg font-semibold">GPS Configuration</h2>
                        <span className="text-sm text-gray-500">
                            {gpsConfig?.globalGPSEnabled ? '(Enabled)' : '(Disabled)'}
                        </span>
                    </div>
                    <button className="text-blue-600 text-sm font-medium">
                        {showConfigPanel ? 'Hide' : 'Show'} Settings
                    </button>
                </div>

                {showConfigPanel && gpsConfig && (
                    <div className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Global GPS Toggle */}
                            <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg">Global GPS Tracking</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Enable or disable GPS tracking for all sellers (unless overridden)
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={gpsConfig.globalGPSEnabled}
                                            onChange={(e) => setGpsConfig({ ...gpsConfig, globalGPSEnabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                            </div>

                            {/* Max Updates Per Week */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Max Updates Per Week
                                </label>
                                <input
                                    type="number"
                                    value={gpsConfig.maxUpdatesPerWeek}
                                    onChange={(e) => setGpsConfig({ ...gpsConfig, maxUpdatesPerWeek: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="1"
                                    max="28"
                                />
                                <p className="text-xs text-gray-500 mt-1">Default: 3-4 total per week</p>
                            </div>

                            {/* Min Interval Minutes */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Min Interval (Minutes)
                                </label>
                                <input
                                    type="number"
                                    value={gpsConfig.minIntervalMinutes}
                                    onChange={(e) => setGpsConfig({ ...gpsConfig, minIntervalMinutes: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="1"
                                    max="1440"
                                />
                                <p className="text-xs text-gray-500 mt-1">Minimum minutes between updates</p>
                            </div>

                            {/* Business Hours Start */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Business Hours Start
                                </label>
                                <input
                                    type="time"
                                    value={gpsConfig.businessHoursStart}
                                    onChange={(e) => setGpsConfig({ ...gpsConfig, businessHoursStart: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            {/* Business Hours End */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Business Hours End
                                </label>
                                <input
                                    type="time"
                                    value={gpsConfig.businessHoursEnd}
                                    onChange={(e) => setGpsConfig({ ...gpsConfig, businessHoursEnd: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            {/* Max Accuracy Meters */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-2">
                                    Max Acceptable Accuracy (Meters)
                                </label>
                                <input
                                    type="number"
                                    value={gpsConfig.maxAccuracyMeters}
                                    onChange={(e) => setGpsConfig({ ...gpsConfig, maxAccuracyMeters: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    min="10"
                                    max="500"
                                    step="10"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    GPS locations with accuracy worse than this will only be logged as observations, not update HQ location
                                </p>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleSaveGPSConfig}
                                disabled={configSaving}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                            >
                                {configSaving ? 'Saving...' : 'Save Configuration'}
                            </button>
                            {gpsConfig.updatedAt && (
                                <div className="flex items-center text-sm text-gray-500">
                                    Last updated: {new Date(gpsConfig.updatedAt).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 md:mb-6">
                    <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
                        <div className="text-xs sm:text-sm text-gray-600">Total</div>
                        <div className="text-xl sm:text-2xl font-bold">{stats.total_sellers}</div>
                    </div>
                    <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
                        <div className="text-xs sm:text-sm text-red-600">Missing</div>
                        <div className="text-xl sm:text-2xl font-bold text-red-800">{stats.missing_gps}</div>
                    </div>
                    <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border border-yellow-200">
                        <div className="text-xs sm:text-sm text-yellow-600">Outdated</div>
                        <div className="text-xl sm:text-2xl font-bold text-yellow-800">{stats.outdated_gps}</div>
                    </div>
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                        <div className="text-xs sm:text-sm text-blue-600">Low Acc.</div>
                        <div className="text-xl sm:text-2xl font-bold text-blue-800">{stats.low_accuracy}</div>
                    </div>
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
                        <div className="text-xs sm:text-sm text-green-600">Avg Acc.</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-800">{stats.avg_accuracy_meters?.toFixed(1)}m</div>
                    </div>
                    {stats.duplicate_locations !== undefined && (
                        <div className="bg-orange-50 p-3 sm:p-4 rounded-lg border border-orange-200">
                            <div className="text-xs sm:text-sm text-orange-600">Duplicates</div>
                            <div className="text-xl sm:text-2xl font-bold text-orange-800">{stats.duplicate_locations}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Bulk Actions */}
            <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm mb-4 md:mb-6">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                    <button
                        onClick={handleBulkFixSwapped}
                        disabled={updating}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Fix Swapped Coordinates</span>
                        <span className="sm:hidden">Fix Swapped</span>
                        {selectedSuppliers.size > 0 && ` (${selectedSuppliers.size})`}
                    </button>
                    <button
                        onClick={handleSetDefaultKigali}
                        disabled={updating}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        <MapPin className="h-4 w-4" />
                        <span className="hidden sm:inline">Set Default (Kigali)</span>
                        <span className="sm:hidden">Set Default</span>
                        {selectedSuppliers.size > 0 && ` (${selectedSuppliers.size})`}
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV (Ctrl+E)</span>
                        <span className="sm:hidden">Export CSV</span>
                    </button>
                    <label className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer flex items-center justify-center gap-2 text-sm sm:text-base">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">Bulk Upload CSV</span>
                        <span className="sm:hidden">Upload CSV</span>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleBulkUpload}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* View Controls */}
            <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm mb-4 md:mb-6">
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowMapView(false)}
                            className={`px-4 py-2 rounded font-medium ${!showMapView ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            📋 Table View
                        </button>
                        <button
                            onClick={() => setShowMapView(true)}
                            className={`px-4 py-2 rounded font-medium ${showMapView ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            🗺️ Map View
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Sort by:</span>
                        <button
                            onClick={() => setSortBy("default")}
                            className={`px-3 py-1 text-sm rounded ${sortBy === "default" ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            Default
                        </button>
                        <button
                            onClick={() => setSortBy("distance")}
                            className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${sortBy === "distance" ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            <MapPin className="h-3 w-3" />
                            Distance from Kigali
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm mb-4 md:mb-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                            Search {searchTerm && `(${filteredIssues.length} results)`}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                id="search-input"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Type to search name or ID..."
                                className="w-full pl-10 pr-10 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    title="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Status Filter</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="ALL">All Issues</option>
                            <option value="NO_GPS">No GPS</option>
                            <option value="SWAPPED">Swapped</option>
                            <option value="OUT_OF_RANGE_LAT">Out of Range (Lat)</option>
                            <option value="OUT_OF_RANGE_LNG">Out of Range (Lng)</option>
                            <option value="OUTDATED">Outdated</option>
                            <option value="LOW_ACCURACY">Low Accuracy</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Map View or Table View */}
            {
                showMapView ? (
                    <div className="bg-white rounded-lg border shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Map className="h-5 w-5 text-blue-600" />
                            All Suppliers Map View
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Map Container */}
                            <div className="lg:col-span-2">
                                <div className="h-[600px] rounded-lg overflow-hidden border-2 border-gray-300 relative z-0">
                                    {typeof window !== 'undefined' && (
                                        <MapContainer
                                            center={[-1.9536, 30.0606]}
                                            zoom={11}
                                            style={{ height: '100%', width: '100%' }}
                                        >
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            />
                                            {filteredIssues
                                                .filter(issue => issue.supplier_latitude && issue.supplier_longitude)
                                                .map((issue) => (
                                                    <Marker
                                                        key={issue.ISHYIGA_ACCOUNT}
                                                        position={[issue.supplier_latitude!, issue.supplier_longitude!]}
                                                    >
                                                        <Popup>
                                                            <div className="p-2 min-w-[200px]">
                                                                <div className="font-bold text-sm">{issue.nickname}</div>
                                                                <div className="text-xs text-gray-600">{issue.ISHYIGA_ACCOUNT}</div>
                                                                <div className="text-xs mt-1">
                                                                    📍 {issue.supplier_latitude?.toFixed(6)}, {issue.supplier_longitude?.toFixed(6)}
                                                                </div>
                                                                {issue.distanceFromKigali < 999 && (
                                                                    <div className="text-xs text-blue-600 mt-1">
                                                                        🚗 {issue.distanceFromKigali.toFixed(1)}km from Kigali
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedSupplier(issue)}
                                                                    className="mt-2 w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                                                >
                                                                    Edit GPS
                                                                </button>
                                                            </div>
                                                        </Popup>
                                                    </Marker>
                                                ))}
                                        </MapContainer>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                    📍 Showing {filteredIssues.filter(i => i.supplier_latitude && i.supplier_longitude).length} suppliers with GPS coordinates. Zoom/pan to explore!
                                </p>
                            </div>

                            {/* Suppliers List */}
                            <div className="overflow-y-auto max-h-[600px] space-y-2">
                                <h4 className="font-medium sticky top-0 bg-white pb-2">Suppliers ({filteredIssues.length})</h4>
                                {paginatedIssues.map(issue => (
                                    <div key={issue.ISHYIGA_ACCOUNT} className="p-3 border rounded hover:bg-gray-50">
                                        <div className="font-medium text-sm">{issue.nickname}</div>
                                        <div className="text-xs text-gray-500">{issue.ISHYIGA_ACCOUNT}</div>
                                        {issue.supplier_latitude && issue.supplier_longitude ? (
                                            <>
                                                <div className="text-xs text-gray-600 mt-1">
                                                    📍 {issue.supplier_latitude.toFixed(4)}, {issue.supplier_longitude.toFixed(4)}
                                                </div>
                                                <div className="text-xs text-blue-600 mt-1">
                                                    🚗 {issue.distanceFromKigali < 999 ? `${issue.distanceFromKigali.toFixed(1)}km from Kigali` : 'No GPS'}
                                                </div>
                                                <a
                                                    href={`https://www.google.com/maps?q=${issue.supplier_latitude},${issue.supplier_longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-green-600 hover:underline mt-1 inline-block"
                                                >
                                                    View on Map →
                                                </a>
                                            </>
                                        ) : (
                                            <div className="text-xs text-red-600 mt-1">No GPS coordinates</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Issues Table */}
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            {/* Selection Info */}
                            {selectedSuppliers.size > 0 && (
                                <div className="px-4 py-3 bg-blue-50 border-b flex items-center justify-between">
                                    <span className="text-sm font-medium text-blue-900">
                                        {selectedSuppliers.size} supplier(s) selected
                                    </span>
                                    <button
                                        onClick={() => setSelectedSuppliers(new Set())}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSuppliers.size === getFilteredIssues().length && getFilteredIssues().length > 0}
                                                    onChange={handleToggleAll}
                                                    className="rounded border-gray-300"
                                                />
                                            </th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Account ID</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Supplier Name</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Distance (km)</th>
                                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-green-700 uppercase tracking-wider">GPS Quality</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Latitude</th>
                                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Longitude</th>
                                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Days Old</th>
                                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                                    Loading GPS issues...
                                                </td>
                                            </tr>
                                        ) : filteredIssues.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                                    No issues found
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedIssues.map((issue) => (
                                                <tr key={issue.ISHYIGA_ACCOUNT} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSuppliers.has(issue.ISHYIGA_ACCOUNT)}
                                                            onChange={() => handleToggleSupplier(issue.ISHYIGA_ACCOUNT)}
                                                            className="rounded border-gray-300"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-mono">{issue.ISHYIGA_ACCOUNT}</td>
                                                    <td className="px-4 py-3 text-sm">{issue.nickname}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {issue.distanceFromKigali < 999 ? (
                                                            <span className="text-blue-600 font-medium">
                                                                {issue.distanceFromKigali.toFixed(1)} km
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">N/A</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {(() => {
                                                            const quality = getQualityBadge(issue.gps_accuracy)
                                                            return (
                                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${quality.color}`}>
                                                                    {quality.icon} {quality.label}
                                                                </span>
                                                            )
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-sm">
                                                        <div className="flex items-center gap-2">
                                                            {issue.supplier_latitude?.toFixed(6) || "-"}
                                                            {issue.supplier_latitude && (
                                                                <button
                                                                    onClick={() => copyToClipboard(issue.supplier_latitude!.toString(), "Latitude")}
                                                                    className="text-gray-400 hover:text-blue-600"
                                                                    title="Copy latitude"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-sm">
                                                        <div className="flex items-center gap-2">
                                                            {issue.supplier_longitude?.toFixed(6) || "-"}
                                                            {issue.supplier_longitude && (
                                                                <button
                                                                    onClick={() => copyToClipboard(issue.supplier_longitude!.toString(), "Longitude")}
                                                                    className="text-gray-400 hover:text-blue-600"
                                                                    title="Copy longitude"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(issue.status)}`}
                                                        >
                                                            {getStatusIcon(issue.status)}
                                                            {issue.status.replace(/_/g, " ")}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">{issue.days_since_update || "-"}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setSelectedSupplier(issue)}
                                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                            >
                                                                Edit
                                                            </button>
                                                            {issue.supplier_latitude && issue.supplier_longitude && (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <a
                                                                        href={`https://www.google.com/maps?q=${issue.supplier_latitude},${issue.supplier_longitude}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                                                                    >
                                                                        <MapPin className="h-3 w-3" />
                                                                        Map
                                                                    </a>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    Showing {startIndex + 1}-{Math.min(endIndex, filteredIssues.length)} of {filteredIssues.length} suppliers
                                    {filteredIssues.length !== issues.length && ` (filtered from ${issues.length} total)`}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        ← Previous
                                    </button>

                                    <span className="text-sm text-gray-700">
                                        Page {currentPage} of {totalPages || 1}
                                    </span>

                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage >= totalPages}
                                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

            {/* Edit Modal */}
            {selectedSupplier && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 pb-4 border-b flex-shrink-0">
                            <h3 className="text-lg font-semibold">
                                Update GPS: {selectedSupplier.nickname}
                            </h3>
                            {selectedSupplier.supplier_latitude && selectedSupplier.supplier_longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${selectedSupplier.supplier_latitude},${selectedSupplier.supplier_longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                                    title="View current location on Google Maps"
                                >
                                    <MapPin className="h-4 w-4" />
                                    View on Map
                                </a>
                            )}
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const formData = new FormData(e.currentTarget)
                                    const lat = parseFloat(formData.get("latitude") as string)
                                    const lng = parseFloat(formData.get("longitude") as string)
                                    handleUpdateSupplier(selectedSupplier.ISHYIGA_ACCOUNT, lat, lng)
                                }}
                            >
                                <div className="space-y-4">
                                    {/* GPS Override Control */}
                                    <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                                        <h4 className="font-semibold mb-2 text-sm">🎚️ GPS Tracking Override</h4>
                                        <select
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            defaultValue="INHERIT"
                                            onChange={(e) => handleSetSellerOverride(selectedSupplier.ISHYIGA_ACCOUNT, e.target.value)}
                                        >
                                            <option value="INHERIT">Inherit from global ({gpsConfig?.globalGPSEnabled ? 'Enabled' : 'Disabled'})</option>
                                            <option value="FORCE_ON">Force ON (always track this seller)</option>
                                            <option value="FORCE_OFF">Force OFF (never track this seller)</option>
                                        </select>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Override the global GPS setting for this specific seller
                                        </p>
                                    </div>

                                    {/* Info Banner */}
                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                                        <p className="font-medium text-blue-900">💡 Two Ways to Add Location:</p>
                                        <p className="text-blue-700 text-xs mt-1">1. <strong>Recommended:</strong> Enter Province/District/Cell - System will geocode later</p>
                                        <p className="text-blue-700 text-xs">2. Enter GPS coordinates directly if you have them</p>
                                    </div>

                                    {/* Administrative Location Fields */}
                                    <div className="border border-gray-200 rounded p-4 bg-gray-50">
                                        <h4 className="font-semibold mb-3 text-sm text-gray-800 flex items-center gap-2">
                                            📍 Administrative Location (Recommended)
                                        </h4>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Province *</label>
                                                <input
                                                    type="text"
                                                    value={selectedSupplier.loc_province || ""}
                                                    onChange={(e) => setSelectedSupplier({
                                                        ...selectedSupplier,
                                                        loc_province: e.target.value
                                                    })}
                                                    placeholder="e.g., Kigali City, Eastern Province, Southern Province"
                                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">District *</label>
                                                <input
                                                    type="text"
                                                    value={selectedSupplier.loc_district || ""}
                                                    onChange={(e) => setSelectedSupplier({
                                                        ...selectedSupplier,
                                                        loc_district: e.target.value
                                                    })}
                                                    placeholder="e.g., Gasabo, Nyarugenge, Rwamagana"
                                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">Cell</label>
                                                <input
                                                    type="text"
                                                    value={selectedSupplier.loc_cell || ""}
                                                    onChange={(e) => setSelectedSupplier({
                                                        ...selectedSupplier,
                                                        loc_cell: e.target.value
                                                    })}
                                                    placeholder="e.g., Kimironko, Kacyiru (optional)"
                                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>

                                            {(selectedSupplier.loc_province || selectedSupplier.loc_district) && (
                                                <div className="bg-green-50 border border-green-200 p-2 rounded text-xs text-green-800">
                                                    ✓ Will geocode: {selectedSupplier.loc_cell ? `${selectedSupplier.loc_cell}, ` : ''}{selectedSupplier.loc_district || '[District]'}, {selectedSupplier.loc_province || '[Province]'}, Rwanda
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* GPS Coordinates Section */}
                                    <div className="border border-gray-200 rounded p-4">
                                        <h4 className="font-semibold mb-3 text-sm text-gray-800 flex items-center gap-2">
                                            🌐 GPS Coordinates (Optional)
                                        </h4>
                                        <p className="text-xs text-gray-500 mb-3">Leave blank if you entered location above</p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Latitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="latitude"
                                                    defaultValue={selectedSupplier.supplier_latitude || ""}
                                                    placeholder="-1.9536 (Rwanda range: -1.0 to -2.9)"
                                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                    id="latitude-input"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Must be between -2.9 and -1.0</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Longitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    name="longitude"
                                                    defaultValue={selectedSupplier.supplier_longitude || ""}
                                                    placeholder="30.0606 (Rwanda range: 28.8 to 30.9)"
                                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                    id="longitude-input"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Must be between 28.8 and 30.9</p>
                                            </div>

                                            {/* Quick Action Buttons */}
                                            <div className="space-y-2">
                                                {/* Use Current Location Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const latInput = document.getElementById("latitude-input") as HTMLInputElement
                                                        const lngInput = document.getElementById("longitude-input") as HTMLInputElement

                                                        if (latInput && lngInput) {
                                                            // Show loading state
                                                            const btn = document.getElementById("location-btn") as HTMLButtonElement
                                                            const originalText = btn?.innerHTML
                                                            if (btn) btn.innerHTML = '<div class="flex items-center gap-2"><div class="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>Getting location...</div>'

                                                            // Get current location
                                                            navigator.geolocation.getCurrentPosition(
                                                                (position) => {
                                                                    latInput.value = position.coords.latitude.toFixed(6)
                                                                    lngInput.value = position.coords.longitude.toFixed(6)
                                                                    if (btn) btn.innerHTML = originalText || ""
                                                                    alert(`✅ Location captured!\nLat: ${position.coords.latitude.toFixed(6)}\nLng: ${position.coords.longitude.toFixed(6)}\nAccuracy: ${position.coords.accuracy.toFixed(0)}m`)
                                                                },
                                                                (error) => {
                                                                    if (btn) btn.innerHTML = originalText || ""
                                                                    let message = "Failed to get location"
                                                                    if (error.code === 1) message = "❌ Location permission denied. Please enable location access in browser settings."
                                                                    else if (error.code === 2) message = "❌ Location unavailable. Make sure GPS is enabled."
                                                                    else if (error.code === 3) message = "❌ Location request timeout. Please try again."
                                                                    alert(message)
                                                                },
                                                                {
                                                                    enableHighAccuracy: true,
                                                                    timeout: 10000,
                                                                    maximumAge: 0
                                                                }
                                                            )
                                                        }
                                                    }}
                                                    id="location-btn"
                                                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <MapPin className="h-4 w-4" />
                                                    Use My Current Location (GPS)
                                                </button>

                                                {/* Set Default Kigali Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const latInput = document.getElementById("latitude-input") as HTMLInputElement
                                                        const lngInput = document.getElementById("longitude-input") as HTMLInputElement
                                                        if (latInput && lngInput) {
                                                            latInput.value = "-1.9536"
                                                            lngInput.value = "30.0606"
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <MapPin className="h-4 w-4" />
                                                    Set Default (Kigali Center: -1.9536, 30.0606)
                                                </button>
                                            </div>

                                            <div className="bg-blue-50 p-3 rounded text-sm">
                                                <strong>💡 Tip:</strong> Get coordinates from Google Maps by right-clicking on the
                                                location
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="submit"
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {updating ? "Updating..." : "Update Coordinates"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSupplier(null)}
                                            className="px-4 py-2 border rounded hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
