/**
 * Rwanda-ish bounds check for seller shop GPS (browser capture).
 * Matches the margin used by components/gps-capture.tsx.
 */
const RWANDA = {
  latMin: -2.9 - 0.3,
  latMax: -1.0 + 0.3,
  lngMin: 28.8 - 0.3,
  lngMax: 30.9 + 0.3,
}

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

/**
 * `gps_accuracy` is DECIMAL(6,2) — max 9999.99 meters.
 * Browser accuracy can exceed that (desktop/IP geolocation often reports 20000m+).
 * Out-of-range / non-finite values become null so they cannot abort a GPS write.
 * Coordinates are never invented or altered here.
 */
export const GPS_ACCURACY_DB_MAX = 9999.99

export function normalizeGpsAccuracyForDb(accuracy: unknown): number | null {
  if (accuracy == null) return null
  const n = typeof accuracy === "number" ? accuracy : Number(accuracy)
  if (!Number.isFinite(n) || n < 0 || n > GPS_ACCURACY_DB_MAX) return null
  return Math.round(n * 100) / 100
}

/**
 * Encode lat/lng to a geohash string (default precision 8 ≈ 19m).
 * Used for supplier_geohash on account_signup / account_seller.
 */
export function encodeGeohash(lat: number, lng: number, precision = 8): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ""
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return ""
  const p = Math.max(1, Math.min(12, Math.floor(precision)))

  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let hash = ""
  let bit = 0
  let ch = 0
  let even = true

  while (hash.length < p) {
    if (even) {
      const mid = (lngMin + lngMax) / 2
      if (lng >= mid) {
        ch |= 1 << (4 - bit)
        lngMin = mid
      } else {
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) {
        ch |= 1 << (4 - bit)
        latMin = mid
      } else {
        latMax = mid
      }
    }
    even = !even
    if (bit < 4) {
      bit += 1
    } else {
      hash += GEOHASH_BASE32[ch]!
      bit = 0
      ch = 0
    }
  }
  return hash
}

export function isShopGpsInRwanda(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= RWANDA.latMin &&
    lat <= RWANDA.latMax &&
    lng >= RWANDA.lngMin &&
    lng <= RWANDA.lngMax
  )
}

export type BrowserGpsErrorKind = "unsupported" | "denied" | "unavailable" | "timeout" | "unknown"

export function classifyBrowserGpsError(err: GeolocationPositionError | null): BrowserGpsErrorKind {
  if (!err) return "unknown"
  if (err.code === err.PERMISSION_DENIED) return "denied"
  if (err.code === err.POSITION_UNAVAILABLE) return "unavailable"
  if (err.code === err.TIMEOUT) return "timeout"
  return "unknown"
}
