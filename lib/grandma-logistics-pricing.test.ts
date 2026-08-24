/**
 * Grandma GPS logistics pricing.
 * Run: npx tsx --test lib/grandma-logistics-pricing.test.ts
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import assert from "node:assert/strict"
import { haversineKm } from "./geo-haversine"
import {
  formatGrandmaDistanceKm,
  grandmaDeliveryDistanceKm,
  grandmaDeliveryDistanceKmResolved,
  grandmaLogisticsBaseFeeRwf,
  grandmaLogisticsUsesFallback,
  grandmaShopGpsOrNull,
  isExactNullIsland,
  isUsablePricingLatLng,
  mergeFetchedSellerGps,
  parseSupplierLocationGps,
  quoteGrandmaFulfillmentFeeRwf,
  quoteGrandmaLogisticsFeeRwf,
  quoteGrandmaLogisticsFeesRwf,
  sellerGpsCacheKey,
  GRANDMA_LOGISTICS_RATES,
  GRANDMA_TAKEAWAY_FEE_RWF,
} from "./grandma-logistics-pricing"

const CUSTOMER = { lat: -1.9536, lng: 30.0906 }

function sellerNorthOf(km: number) {
  const dLat = km / 111.32
  return { lat: CUSTOMER.lat + dLat, lng: CUSTOMER.lng }
}

test("1. human pricing with distance uses base + per-km", () => {
  const km = 2.4
  assert.equal(
    quoteGrandmaLogisticsFeeRwf("human", km),
    Math.round(GRANDMA_LOGISTICS_RATES.human.baseRwf + GRANDMA_LOGISTICS_RATES.human.rwfPerKm * km),
  )
})

test("2. bike pricing with distance uses base + per-km", () => {
  const km = 2.4
  assert.equal(
    quoteGrandmaLogisticsFeeRwf("bike", km),
    Math.round(GRANDMA_LOGISTICS_RATES.bike.baseRwf + GRANDMA_LOGISTICS_RATES.bike.rwfPerKm * km),
  )
})

test("3. moto pricing with distance uses base + per-km", () => {
  const km = 2.4
  assert.equal(
    quoteGrandmaLogisticsFeeRwf("moto", km),
    Math.round(GRANDMA_LOGISTICS_RATES.moto.baseRwf + GRANDMA_LOGISTICS_RATES.moto.rwfPerKm * km),
  )
})

test("4. missing distance returns base fee", () => {
  assert.equal(quoteGrandmaLogisticsFeeRwf("human", null), grandmaLogisticsBaseFeeRwf("human"))
  assert.equal(quoteGrandmaLogisticsFeeRwf("bike", undefined), grandmaLogisticsBaseFeeRwf("bike"))
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", Number.NaN), grandmaLogisticsBaseFeeRwf("moto"))
  assert.equal(quoteGrandmaLogisticsFeesRwf(null).human, 150)
  assert.equal(quoteGrandmaLogisticsFeesRwf(null).bike, 200)
  assert.equal(quoteGrandmaLogisticsFeesRwf(null).moto, 250)
})

test("5. exact 0,0 placeholder is missing GPS; lone 0 is allowed", () => {
  assert.equal(isExactNullIsland(0, 0), true)
  assert.equal(isUsablePricingLatLng(0, 0), false)
  assert.equal(grandmaShopGpsOrNull(0, 0), null)
  assert.equal(isUsablePricingLatLng(0, 30.09), true)
  assert.equal(isUsablePricingLatLng(-1.95, 0), true)
  assert.equal(grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, 0, 0), null)
})

test("6. valid coordinates calculate Haversine distance", () => {
  const seller = sellerNorthOf(0.6)
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, seller.lat, seller.lng)
  assert.ok(km != null && Number.isFinite(km))
  assert.ok(Math.abs(km! - 0.6) < 0.02)
  assert.equal(haversineKm(CUSTOMER.lat, CUSTOMER.lng, CUSTOMER.lat, CUSTOMER.lng), 0)
  assert.equal(grandmaLogisticsUsesFallback(km), false)
})

test("7. supplier-location API payload parsing", () => {
  assert.equal(parseSupplierLocationGps(null), null)
  assert.equal(parseSupplierLocationGps({ ok: false, error: "Supplier not found" }), null)
  assert.equal(parseSupplierLocationGps({ ok: true, location: { latitude: 0, longitude: 0 } }), null)
  const servlet = parseSupplierLocationGps({
    ok: true,
    location: { latitude: CUSTOMER.lat, longitude: CUSTOMER.lng },
  })
  assert.ok(servlet)
  assert.equal(servlet!.latitude, CUSTOMER.lat)
  assert.equal(servlet!.longitude, CUSTOMER.lng)
  const strings = parseSupplierLocationGps({
    ok: true,
    location: { latitude: String(CUSTOMER.lat), longitude: String(CUSTOMER.lng) },
  })
  assert.ok(strings)
  const alt = parseSupplierLocationGps({
    supplier_latitude: CUSTOMER.lat,
    supplier_longitude: CUSTOMER.lng,
  })
  assert.ok(alt)
  assert.equal(alt!.latitude, CUSTOMER.lat)
})

test("8. known distance is reused when shop GPS is missing", () => {
  const reused = grandmaDeliveryDistanceKmResolved({
    customerLat: CUSTOMER.lat,
    customerLng: CUSTOMER.lng,
    shopLat: null,
    shopLng: null,
    knownDistanceKm: 2.4,
  })
  assert.equal(reused, 2.4)
  assert.equal(
    quoteGrandmaLogisticsFeeRwf("human", reused),
    Math.round(150 + 85 * 2.4),
  )
})

test("9. selected shop changes cause a new distance/quote", () => {
  const shopA = sellerNorthOf(1)
  const shopB = sellerNorthOf(4)
  const kmA = grandmaDeliveryDistanceKmResolved({
    customerLat: CUSTOMER.lat,
    customerLng: CUSTOMER.lng,
    shopLat: shopA.lat,
    shopLng: shopA.lng,
  })
  const kmB = grandmaDeliveryDistanceKmResolved({
    customerLat: CUSTOMER.lat,
    customerLng: CUSTOMER.lng,
    shopLat: shopB.lat,
    shopLng: shopB.lng,
  })
  assert.ok(kmA != null && kmB != null)
  assert.ok(Math.abs(kmA! - kmB!) > 2)
  const feesA = quoteGrandmaLogisticsFeesRwf(kmA)
  const feesB = quoteGrandmaLogisticsFeesRwf(kmB)
  assert.notEqual(feesA.human, feesB.human)
  assert.notEqual(feesA.bike, feesB.bike)
  assert.notEqual(feesA.moto, feesB.moto)
  assert.ok(feesB.moto > feesA.moto)
})

test("10. stale async shop-location responses cannot overwrite the currently selected shop", () => {
  const gpsA = { latitude: -1.95, longitude: 30.06 }
  const gpsB = { latitude: -1.98, longitude: 30.12 }
  const afterA = mergeFetchedSellerGps({}, "shopA", "shopA", gpsA)
  assert.deepEqual(afterA.SHOPA, gpsA)
  const stale = mergeFetchedSellerGps(afterA, "shopA", "shopB", gpsA)
  assert.equal(stale, afterA)
  assert.equal(stale.SHOPB, undefined)
  const afterB = mergeFetchedSellerGps(stale, "shopB", "shopB", gpsB)
  assert.deepEqual(afterB.SHOPB, gpsB)
  assert.deepEqual(afterB.SHOPA, gpsA)
  assert.equal(sellerGpsCacheKey("  shopA "), "SHOPA")
})

test("same coordinates are 0 km and quote base fees only", () => {
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, CUSTOMER.lat, CUSTOMER.lng)
  assert.equal(km, 0)
  assert.equal(quoteGrandmaLogisticsFeeRwf("human", km), GRANDMA_LOGISTICS_RATES.human.baseRwf)
  assert.equal(quoteGrandmaLogisticsFeeRwf("bike", km), GRANDMA_LOGISTICS_RATES.bike.baseRwf)
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", km), GRANDMA_LOGISTICS_RATES.moto.baseRwf)
})

test("pickup is 0 and takeaway uses configured takeaway fee", () => {
  assert.equal(quoteGrandmaFulfillmentFeeRwf("pickup", "moto", 2), 0)
  assert.equal(quoteGrandmaFulfillmentFeeRwf("takeaway", "moto", 2), GRANDMA_TAKEAWAY_FEE_RWF)
})

test("live GPS wins over a stale known-distance value", () => {
  const seller = sellerNorthOf(3)
  const live = grandmaDeliveryDistanceKmResolved({
    customerLat: CUSTOMER.lat,
    customerLng: CUSTOMER.lng,
    shopLat: seller.lat,
    shopLng: seller.lng,
    knownDistanceKm: 99,
  })
  assert.ok(live != null && Math.abs(live - 3) < 0.05)
})

test("Infinity known distance is not reused", () => {
  assert.equal(formatGrandmaDistanceKm(Number.POSITIVE_INFINITY), "—")
  const km = grandmaDeliveryDistanceKmResolved({
    customerLat: CUSTOMER.lat,
    customerLng: CUSTOMER.lng,
    shopLat: null,
    shopLng: null,
    knownDistanceKm: Number.POSITIVE_INFINITY,
  })
  assert.equal(km, null)
})

test("no screenshot constants or Math.random in logistics pricing source", () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "grandma-logistics-pricing.ts"), "utf8")
  assert.equal(src.includes("202"), false)
  assert.equal(src.includes("267"), false)
  assert.equal(src.includes("339"), false)
  assert.equal(src.includes("Math.random"), false)
})
