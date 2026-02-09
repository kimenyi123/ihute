"use client"

import { useEffect, useRef, useState } from "react"
import { queueGPSUpdate, syncPendingUpdates } from "@/lib/gpsQueue"

type Options = {
    enabled?: boolean
    endpoint?: string
    minAccuracyMeters?: number
    minMoveMeters?: number
    movingIntervalMs?: number
    stillIntervalMs?: number
    maxIntervalMs?: number
    debug?: boolean
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns distance in meters
 */
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371000 // Earth radius in meters
    const toRad = (x: number) => (x * Math.PI) / 180

    const dLat = toRad(bLat - aLat)
    const dLng = toRad(bLng - aLng)

    const s1 = Math.sin(dLat / 2) ** 2
    const s2 = Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2

    return 2 * R * Math.asin(Math.sqrt(s1 + s2))
}

/**
 * Background GPS tracking hook for suppliers
 * Monitors location while dashboard is open and sends updates to backend
 */
export function useSupplierLocationHeartbeat(opts: Options = {}) {
    const {
        enabled = false, // CHANGED: GPS disabled by default, must be enabled by admin
        endpoint = "/api/supplier/location/update",
        minAccuracyMeters = 100,
        minMoveMeters = 50,
        movingIntervalMs = 60_000, // 60 seconds
        stillIntervalMs = 5 * 60_000, // 5 minutes
        maxIntervalMs = 10 * 60_000, // 10 minutes
        debug = false,
    } = opts

    const [status, setStatus] = useState<
        "idle" | "requesting" | "watching" | "denied" | "error"
    >("idle")
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const [queueSize, setQueueSize] = useState(0)

    const watchIdRef = useRef<number | null>(null)
    const lastSentRef = useRef<number>(0)
    const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
    const lastModeRef = useRef<"moving" | "still">("still")

    async function sendLocation(payload: any) {
        // If offline, queue the update
        if (!isOnline) {
            if (debug) console.log("[GPS] Offline - queueing update")
            try {
                await queueGPSUpdate(payload)
                setQueueSize(prev => prev + 1)
            } catch (e) {
                console.error("[GPS] Failed to queue offline update:", e)
            }
            return null
        }

        // Online - send immediately
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "include",
            })

            const data = await res.json()

            if (debug) {
                console.log("[GPS] Sent location update:", payload)
                console.log("[GPS] Response:", res.status, data)
            }

            return data
        } catch (e) {
            if (debug) {
                console.error("[GPS] Failed to send location:", e)
            }
            // Queue on network error
            try {
                await queueGPSUpdate(payload)
                setQueueSize(prev => prev + 1)
                if (debug) console.log("[GPS] Queued due to network error")
            } catch (qe) {
                console.error("[GPS] Failed to queue:", qe)
            }
            return null
        }
    }

    // Online/offline detection and sync
    useEffect(() => {
        const handleOnline = async () => {
            if (debug) console.log("[GPS] Back online - syncing queue...")
            setIsOnline(true)

            try {
                const result = await syncPendingUpdates(endpoint)
                if (debug) {
                    console.log(`[GPS] Synced ${result.synced} updates, ${result.failed} failed`)
                }
                setQueueSize(result.failed)

                // Trigger service worker background sync
                if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
                    const registration = await navigator.serviceWorker.ready
                    await registration.sync.register('sync-gps-updates')
                }
            } catch (e) {
                console.error("[GPS] Sync failed:", e)
            }
        }

        const handleOffline = () => {
            if (debug) console.log("[GPS] Gone offline")
            setIsOnline(false)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [endpoint, debug])

    useEffect(() => {
        if (!enabled) {
            if (debug) console.log("[GPS] Hook disabled")
            return
        }

        if (!("geolocation" in navigator)) {
            console.error("[GPS] Geolocation not supported by browser")
            setStatus("error")
            return
        }

        setStatus("requesting")

        const options: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 15_000, // Use cached position up to 15s old
            timeout: 15_000, // Wait max 15s for position
        }

        const onPosition = (pos: GeolocationPosition) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            const acc = pos.coords.accuracy ?? 9999
            const speed = pos.coords.speed ?? 0
            const heading = pos.coords.heading ?? 0

            const now = Date.now()
            const lastSent = lastSentRef.current
            const lastCoords = lastCoordsRef.current

            // Calculate movement
            const moved =
                lastCoords == null ? Infinity : haversineMeters(lastCoords.lat, lastCoords.lng, lat, lng)

            // Determine if supplier is moving
            const moving = speed > 0.7 || moved >= minMoveMeters
            const desiredInterval = moving ? movingIntervalMs : stillIntervalMs
            lastModeRef.current = moving ? "moving" : "still"

            // Check if update is due
            const timeSinceLastUpdate = now - lastSent
            const dueByTime = timeSinceLastUpdate >= desiredInterval
            const dueByMax = timeSinceLastUpdate >= maxIntervalMs
            const goodAccuracy = acc <= minAccuracyMeters

            if (debug) {
                console.log("[GPS] Position:", {
                    lat: lat.toFixed(6),
                    lng: lng.toFixed(6),
                    accuracy: `${acc.toFixed(1)}m`,
                    speed: `${speed.toFixed(2)} m/s`,
                    moved: `${moved.toFixed(1)}m`,
                    mode: lastModeRef.current,
                    timeSince: `${Math.floor(timeSinceLastUpdate / 1000)}s`,
                    dueByTime,
                    dueByMax,
                    goodAccuracy,
                })
            }

            // Decide whether to send update
            const shouldUpdate = (dueByTime && goodAccuracy) || dueByMax

            if (shouldUpdate) {
                lastSentRef.current = now
                lastCoordsRef.current = { lat, lng }

                sendLocation({
                    lat,
                    lng,
                    accuracy: acc,
                    speed,
                    heading,
                    source: "dashboard_watchPosition",
                    mode: lastModeRef.current,
                })
            }

            setStatus("watching")
        }

        const onError = (err: GeolocationPositionError) => {
            if (debug) {
                console.error("[GPS] Geolocation error:", {
                    code: err.code,
                    message: err.message,
                })
            }

            if (err.code === err.PERMISSION_DENIED) {
                setStatus("denied")
            } else {
                setStatus("error")
            }
        }

        // Start watching position
        if (debug) console.log("[GPS] Starting position watch...")
        watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, options)

        // Optional: Pause updates when tab is hidden (battery optimization)
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                if (debug) console.log("[GPS] Tab hidden - updates will pause")
            } else {
                if (debug) console.log("[GPS] Tab visible - updates will resume")
            }
        }
        document.addEventListener("visibilitychange", onVisibilityChange)

        // Cleanup on unmount
        return () => {
            if (debug) console.log("[GPS] Stopping position watch")

            document.removeEventListener("visibilitychange", onVisibilityChange)

            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
            }
            watchIdRef.current = null
            setStatus("idle")
        }
    }, [enabled, endpoint, minAccuracyMeters, minMoveMeters, movingIntervalMs, stillIntervalMs, maxIntervalMs, debug])

    return { status, isOnline, queueSize }
}
