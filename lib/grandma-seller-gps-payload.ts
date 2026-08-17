/**
 * Pure helpers for Grandma seller GPS registration payload + API extraction.
 * No network / DB — safe for unit tests (self-contained; no path aliases).
 */

const RWANDA = {
  latMin: -2.9 - 0.3,
  latMax: -1.0 + 0.3,
  lngMin: 28.8 - 0.3,
  lngMax: 30.9 + 0.3,
}

export type GrandmaSellerGpsFields = {
  latitude: number
  longitude: number
  gpsAccuracy?: number
  supplier_latitude: number
  supplier_longitude: number
  gps_accuracy?: number
  gps_last_updated: string
  location_source: "AUTO"
}

/** Reject null-island / non-Rwanda placeholders — never invent coordinates. */
export function isUsableGrandmaShopGps(lat: unknown, lng: unknown): lat is number {
  const la = typeof lat === "number" ? lat : Number(lat)
  const lo = typeof lng === "number" ? lng : Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  if (la === 0 && lo === 0) return false
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false
  return la >= RWANDA.latMin && la <= RWANDA.latMax && lo >= RWANDA.lngMin && lo <= RWANDA.lngMax
}

/** Build GPS fields included in POST /api/grandma/sellers body. */
export function buildGrandmaSellerGpsPayload(input: {
  latitude: number | null | undefined
  longitude: number | null | undefined
  gpsAccuracy?: number | null
  capturedAt?: Date
}): GrandmaSellerGpsFields | null {
  const lat = input.latitude
  const lng = input.longitude
  if (lat == null || lng == null || !isUsableGrandmaShopGps(lat, lng)) {
    return null
  }
  const out: GrandmaSellerGpsFields = {
    latitude: lat,
    longitude: lng,
    supplier_latitude: lat,
    supplier_longitude: lng,
    gps_last_updated: (input.capturedAt ?? new Date()).toISOString(),
    location_source: "AUTO",
  }
  if (input.gpsAccuracy != null && Number.isFinite(Number(input.gpsAccuracy))) {
    const a = Number(input.gpsAccuracy)
    out.gpsAccuracy = a
    out.gps_accuracy = a
  }
  return out
}

export type ExtractedRegistrationGps = {
  latitude: number
  longitude: number
  gpsAccuracy: number | null
}

/** Extract GPS from registration API body (camelCase or supplier_* / snake_case). */
export function extractGpsFromRegistrationBody(
  body: Record<string, unknown> | null | undefined,
): ExtractedRegistrationGps | null {
  if (!body) return null
  const latRaw = body.latitude ?? body.supplier_latitude
  const lngRaw = body.longitude ?? body.supplier_longitude
  const lat = latRaw != null ? Number(latRaw) : NaN
  const lng = lngRaw != null ? Number(lngRaw) : NaN
  if (!isUsableGrandmaShopGps(lat, lng)) return null
  const accuracyRaw = body.gpsAccuracy ?? body.gps_accuracy
  const gpsAccuracy =
    accuracyRaw != null && Number.isFinite(Number(accuracyRaw)) ? Number(accuracyRaw) : null
  return { latitude: lat, longitude: lng, gpsAccuracy }
}

/** SQL column names written by persistGrandmaSellerGps (regression lock). */
export const GRANDMA_GPS_PERSIST_COLUMNS = [
  "supplier_latitude",
  "supplier_longitude",
  "supplier_geohash",
  "gps_accuracy",
  "gps_last_updated",
  "location_source",
] as const
