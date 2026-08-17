/** Earth radius in km (mean). */
const EARTH_RADIUS_KM = 6371

/** Haversine great-circle distance in kilometers. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** MySQL expression fragment for Haversine (km). Placeholders: lat, lng, lat again. */
export const MYSQL_HAVERSINE_KM = `(
  6371 * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(?)) * cos(radians(a.supplier_latitude))
      * cos(radians(a.supplier_longitude) - radians(?))
      + sin(radians(?)) * sin(radians(a.supplier_latitude))
    ))
  )
)`

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  if (lat == null || lng == null) return false
  if (typeof lat === "string" && lat.trim() === "") return false
  if (typeof lng === "string" && lng.trim() === "") return false
  if (typeof lat === "boolean" || typeof lng === "boolean") return false
  const la = typeof lat === "number" ? lat : Number(lat)
  const lo = typeof lng === "number" ? lng : Number(lng)
  return (
    Number.isFinite(la) &&
    Number.isFinite(lo) &&
    la >= -90 &&
    la <= 90 &&
    lo >= -180 &&
    lo <= 180
  )
}
