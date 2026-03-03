'use client'
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface ExpansionArea {
    geohash: string
    lat: number
    lng: number
    demand_score: number
}

interface ServiceAreaMapProps {
    center_lat: number
    center_lng: number
    coverage_radius_km: number
    suggested_radius_km: number
    expansion_areas: ExpansionArea[]
}

export default function ServiceAreaMap({ center_lat, center_lng, coverage_radius_km, suggested_radius_km, expansion_areas }: ServiceAreaMapProps) {
    return (
        <MapContainer
            center={[center_lat, center_lng]}
            zoom={11}
            style={{ height: '500px', width: '100%' }}
            className="rounded-lg"
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[center_lat, center_lng]}>
                <Popup>Your Operation Center</Popup>
            </Marker>
            <Circle
                center={[center_lat, center_lng]}
                radius={coverage_radius_km * 1000}
                pathOptions={{ fillColor: '#10b981', fillOpacity: 0.15, color: '#10b981', weight: 2, dashArray: '5, 5' }}
            />
            <Circle
                center={[center_lat, center_lng]}
                radius={suggested_radius_km * 1000}
                pathOptions={{ fillColor: '#f59e0b', fillOpacity: 0.1, color: '#f59e0b', weight: 2 }}
            />
            {expansion_areas.map((area, index) => (
                <Circle
                    key={index}
                    center={[area.lat, area.lng]}
                    radius={500}
                    pathOptions={{ fillColor: '#ef4444', fillOpacity: 0.4, color: '#ef4444', weight: 1 }}
                >
                    <Popup>
                        <div className="text-sm">
                            <strong>Expansion Opportunity</strong><br />
                            Demand Score: {area.demand_score}/100
                        </div>
                    </Popup>
                </Circle>
            ))}
        </MapContainer>
    )
}
