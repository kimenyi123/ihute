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
