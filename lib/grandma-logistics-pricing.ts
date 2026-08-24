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

/** Existing Grandma logistics schedule used in checkout. */
export const GRANDMA_LOGISTICS_RATES: Record<GrandmaLogisticsId, GrandmaLogisticsRate> = {
  human: { baseRwf: 150, rwfPerKm: 85 },
  bike: { baseRwf: 200, rwfPerKm: 110 },
  moto: { baseRwf: 250, rwfPerKm: 145 },
}

export const GRANDMA_TAKEAWAY_FEE_RWF = 500

/** Precise km between customer and seller. Null when either GPS is missing/invalid. */
export function grandmaDeliveryDistanceKm(
  customerLat: unknown,
  customerLng: unknown,
  sellerLat: unknown,
  sellerLng: unknown,
): number | null {
  if (!isValidLatLng(customerLat, customerLng) || !isValidLatLng(sellerLat, sellerLng)) return null
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

/** Display km to 1 decimal; never Infinity/NaN. */
export function formatGrandmaDistanceKm(distanceKm: number | null | undefined): string {
  if (!isUsableDeliveryDistanceKm(distanceKm)) return "—"
  return `${distanceKm.toFixed(1)} km`
}
