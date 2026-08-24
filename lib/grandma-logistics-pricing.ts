/**
 * Grandma delivery pricing: GPS → Haversine → transport rates → fee.
 * Rates are the existing Grandma checkout rules (not screenshot constants).
 * Missing/invalid GPS uses the configured base fee so checkout always has a finite price.
 */
import { haversineKm, isValidLatLng } from "@/lib/geo-haversine"

export type GrandmaLogisticsId = "human" | "bike" | "moto"
export type GrandmaFulfillmentMode = "delivery" | "pickup" | "takeaway"

export type GrandmaLogisticsRate = {
  baseRwf: number
  rwfPerKm: number
}

export type GrandmaShopGps = {
  latitude: number
  longitude: number
}

export type GrandmaSellerGpsCache = Record<string, GrandmaShopGps | null>

/** Existing Grandma logistics schedule used in checkout. */
export const GRANDMA_LOGISTICS_RATES: Record<GrandmaLogisticsId, GrandmaLogisticsRate> = {
  human: { baseRwf: 150, rwfPerKm: 85 },
  bike: { baseRwf: 200, rwfPerKm: 110 },
  moto: { baseRwf: 250, rwfPerKm: 145 },
}

export const GRANDMA_TAKEAWAY_FEE_RWF = 500

/** Exact 0,0 only — Java getDouble(NULL) serializes missing GPS as 0.0/0.0. */
export function isExactNullIsland(lat: unknown, lng: unknown): boolean {
  const la = typeof lat === "number" ? lat : Number(lat)
  const lo = typeof lng === "number" ? lng : Number(lng)
  return Number.isFinite(la) && Number.isFinite(lo) && la === 0 && lo === 0
}

/**
 * Pricing GPS: finite in-range pair. Latitude 0 or longitude 0 alone is allowed.
 * The pair 0,0 is the existing missing-GPS placeholder and is rejected.
 */
export function isUsablePricingLatLng(lat: unknown, lng: unknown): boolean {
  if (!isValidLatLng(lat, lng)) return false
  return !isExactNullIsland(lat, lng)
}

/** Precise km between customer and seller. Null when either GPS is missing/invalid. */
export function grandmaDeliveryDistanceKm(
  customerLat: unknown,
  customerLng: unknown,
  sellerLat: unknown,
  sellerLng: unknown,
): number | null {
  if (!isUsablePricingLatLng(customerLat, customerLng) || !isUsablePricingLatLng(sellerLat, sellerLng)) {
    return null
  }
  const km = haversineKm(Number(customerLat), Number(customerLng), Number(sellerLat), Number(sellerLng))
  return Number.isFinite(km) && km >= 0 ? km : null
}

export function isUsableDeliveryDistanceKm(distanceKm: unknown): distanceKm is number {
  return typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm < 20_000
}

/** True when checkout should use the base fee instead of a GPS/Haversine quote. */
export function grandmaLogisticsUsesFallback(distanceKm: number | null | undefined): boolean {
  return !isUsableDeliveryDistanceKm(distanceKm)
}

/** Configured minimum/base logistics charge for a transport type. */
export function grandmaLogisticsBaseFeeRwf(transport: GrandmaLogisticsId): number {
  return GRANDMA_LOGISTICS_RATES[transport].baseRwf
}

/**
 * Delivery fee in RWF for a transport type. Always finite.
 * Usable GPS distance → base + per-km. Otherwise the configured base fee (not a fake km).
 */
export function quoteGrandmaLogisticsFeeRwf(
  transport: GrandmaLogisticsId,
  distanceKm: number | null | undefined,
): number {
  const rate = GRANDMA_LOGISTICS_RATES[transport]
  if (!isUsableDeliveryDistanceKm(distanceKm)) return rate.baseRwf
  const fee = Math.round(rate.baseRwf + rate.rwfPerKm * distanceKm)
  return Number.isFinite(fee) && fee >= 0 ? fee : rate.baseRwf
}

export function quoteGrandmaFulfillmentFeeRwf(
  fulfillment: GrandmaFulfillmentMode,
  transport: GrandmaLogisticsId,
  distanceKm: number | null | undefined,
): number {
  if (fulfillment === "pickup") return 0
  if (fulfillment === "takeaway") return GRANDMA_TAKEAWAY_FEE_RWF
  return quoteGrandmaLogisticsFeeRwf(transport, distanceKm)
}

export function quoteGrandmaLogisticsFeesRwf(distanceKm: number | null | undefined): {
  human: number
  bike: number
  moto: number
} {
  return {
    human: quoteGrandmaLogisticsFeeRwf("human", distanceKm),
    bike: quoteGrandmaLogisticsFeeRwf("bike", distanceKm),
    moto: quoteGrandmaLogisticsFeeRwf("moto", distanceKm),
  }
}

/** Display km to 1 decimal; never Infinity/NaN. */
export function formatGrandmaDistanceKm(distanceKm: number | null | undefined): string {
  if (!isUsableDeliveryDistanceKm(distanceKm)) return "—"
  return `${distanceKm.toFixed(1)} km`
}

export function grandmaShopGpsOrNull(lat: unknown, lng: unknown): GrandmaShopGps | null {
  if (!isUsablePricingLatLng(lat, lng)) return null
  return { latitude: Number(lat), longitude: Number(lng) }
}

function coordFrom(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null && record[key] !== "") return record[key]
  }
  return undefined
}

/**
 * SupplierLocationServlet getLocation:
 * `{ ok: true, location: { latitude, longitude } }`
 * `{ ok: false, error }`
 * Missing DB GPS arrives as 0,0 via JDBC getDouble.
 */
export function parseSupplierLocationGps(payload: unknown): GrandmaShopGps | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as Record<string, unknown>
  if (root.ok === false) return null
  const loc =
    root.location && typeof root.location === "object"
      ? (root.location as Record<string, unknown>)
      : root
  return grandmaShopGpsOrNull(
    coordFrom(loc, ["latitude", "supplier_latitude"]),
    coordFrom(loc, ["longitude", "supplier_longitude"]),
  )
}

export function sellerGpsCacheKey(account: string): string {
  return account.trim().toUpperCase()
}

/**
 * Apply a shop-location fetch only when it still matches the currently selected seller.
 * A late Shop A response must not write Shop B's cache entry.
 */
export function mergeFetchedSellerGps(
  prev: GrandmaSellerGpsCache,
  requestedAccount: string,
  selectedAccount: string,
  gps: GrandmaShopGps | null,
): GrandmaSellerGpsCache {
  const requested = sellerGpsCacheKey(requestedAccount)
  const selected = sellerGpsCacheKey(selectedAccount)
  if (!requested || requested !== selected) return prev
  return { ...prev, [requested]: gps }
}

/**
 * Distance for Grandma logistics quote.
 * Both GPS → live Haversine (so a new shop or moved customer updates the fee).
 * Shop GPS missing + finite Near Me/search km for this shop → reuse that km.
 */
export function grandmaDeliveryDistanceKmResolved(args: {
  customerLat: unknown
  customerLng: unknown
  shopLat: unknown
  shopLng: unknown
  knownDistanceKm?: unknown
}): number | null {
  const shop = grandmaShopGpsOrNull(args.shopLat, args.shopLng)
  const fromGps = grandmaDeliveryDistanceKm(
    args.customerLat,
    args.customerLng,
    shop?.latitude,
    shop?.longitude,
  )
  if (fromGps != null) return fromGps
  if (isUsableDeliveryDistanceKm(args.knownDistanceKm)) return args.knownDistanceKm
  return null
}
