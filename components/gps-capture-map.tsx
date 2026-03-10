"use client"

import { useEffect, useRef } from "react"

const KIGALI_CENTER = { lat: -1.9536, lng: 30.0606 }

export function GPSCaptureMapInner({
  center,
  position,
  setPosition,
}: {
  center: { lat: number; lng: number }
  position: { lat: number; lng: number } | null
  setPosition: (latlng: { lat: number; lng: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return

    const L = require("leaflet") as typeof import("leaflet")
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    })

    const container = containerRef.current
    if ((container as any)._leaflet_id != null) return

    const map = L.map(container).setView([center.lat, center.lng], 13)
    mapRef.current = map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    map.on("click", (e: L.LeafletMouseEvent) => {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      delete (container as any)._leaflet_id
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setView([center.lat, center.lng], map.getZoom())
  }, [center.lat, center.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }
    if (position) {
      const L = require("leaflet") as typeof import("leaflet")
      const marker = L.marker([position.lat, position.lng]).addTo(map)
      markerRef.current = marker
    }
  }, [position])

  return <div ref={containerRef} className="h-full w-full z-0" />
}
