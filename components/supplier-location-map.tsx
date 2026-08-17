"use client"

import "leaflet/dist/leaflet.css"

import { useEffect, useRef } from "react"

type SupplierLocationMapProps = {
  lat: number
  lng: number
  onLocationSelect: (lat: number, lng: number) => void
}

function popupHtml(lat: number, lng: number) {
  return `Your Location<br/>Lat: ${lat.toFixed(6)}<br/>Lng: ${lng.toFixed(6)}`
}

export function SupplierLocationMap({ lat, lng, onLocationSelect }: SupplierLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onSelectRef = useRef(onLocationSelect)
  onSelectRef.current = onLocationSelect

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

    const map = L.map(container).setView([lat, lng], 13)
    mapRef.current = map

    setTimeout(() => map.invalidateSize(), 0)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const marker = L.marker([lat, lng]).addTo(map)
    marker.bindPopup(popupHtml(lat, lng))
    markerRef.current = marker

    const onClick = (e: L.LeafletMouseEvent) => {
      onSelectRef.current(e.latlng.lat, e.latlng.lng)
    }
    map.on("click", onClick)

    return () => {
      map.off("click", onClick)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      delete (container as any)._leaflet_id
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    map.setView([lat, lng], map.getZoom())
    marker.setLatLng([lat, lng])
    marker.setPopupContent(popupHtml(lat, lng))
  }, [lat, lng])

  return <div ref={containerRef} className="h-full w-full min-h-[24rem] z-0" />
}
