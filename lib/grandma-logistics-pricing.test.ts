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
  grandmaLogisticsBaseFeeRwf,
  grandmaLogisticsUsesFallback,
  quoteGrandmaFulfillmentFeeRwf,
  quoteGrandmaLogisticsFeeRwf,
  GRANDMA_LOGISTICS_RATES,
  GRANDMA_TAKEAWAY_FEE_RWF,
} from "./grandma-logistics-pricing"

const CUSTOMER = { lat: -1.9536, lng: 30.0906 }

function sellerNorthOf(km: number) {
  const dLat = km / 111.32
  return { lat: CUSTOMER.lat + dLat, lng: CUSTOMER.lng }
}

test("valid GPS yields Haversine distance then dynamic price", () => {
  const seller = sellerNorthOf(0.6)
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, seller.lat, seller.lng)
  assert.ok(km != null && Number.isFinite(km))
  assert.ok(Math.abs(km! - 0.6) < 0.02)
  assert.equal(grandmaLogisticsUsesFallback(km), false)
  const human = quoteGrandmaLogisticsFeeRwf("human", km)
  assert.equal(
    human,
    Math.round(GRANDMA_LOGISTICS_RATES.human.baseRwf + GRANDMA_LOGISTICS_RATES.human.rwfPerKm * km!),
  )
  assert.ok(Number.isFinite(human) && human > grandmaLogisticsBaseFeeRwf("human"))
})

test("same coordinates are 0 km and quote base fees only", () => {
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, CUSTOMER.lat, CUSTOMER.lng)
  assert.equal(km, 0)
  assert.equal(haversineKm(CUSTOMER.lat, CUSTOMER.lng, CUSTOMER.lat, CUSTOMER.lng), 0)
  assert.equal(quoteGrandmaLogisticsFeeRwf("human", km), GRANDMA_LOGISTICS_RATES.human.baseRwf)
  assert.equal(quoteGrandmaLogisticsFeeRwf("bike", km), GRANDMA_LOGISTICS_RATES.bike.baseRwf)
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", km), GRANDMA_LOGISTICS_RATES.moto.baseRwf)
})

test("missing customer GPS → finite fallback base fee", () => {
  const km = grandmaDeliveryDistanceKm(undefined, 30, CUSTOMER.lat, CUSTOMER.lng)
  assert.equal(km, null)
  assert.equal(grandmaLogisticsUsesFallback(km), true)
  assert.equal(quoteGrandmaLogisticsFeeRwf("human", km), grandmaLogisticsBaseFeeRwf("human"))
  assert.equal(quoteGrandmaLogisticsFeeRwf("bike", km), grandmaLogisticsBaseFeeRwf("bike"))
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", km), grandmaLogisticsBaseFeeRwf("moto"))
})

test("missing seller GPS → finite fallback base fee", () => {
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, null, 30)
  assert.equal(km, null)
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", km), grandmaLogisticsBaseFeeRwf("moto"))
})

test("invalid GPS → finite fallback base fee", () => {
  assert.equal(grandmaDeliveryDistanceKm(999, 30, CUSTOMER.lat, CUSTOMER.lng), null)
  assert.equal(grandmaDeliveryDistanceKm(CUSTOMER.lat, 200, CUSTOMER.lat, CUSTOMER.lng), null)
  assert.equal(quoteGrandmaLogisticsFeeRwf("bike", null), grandmaLogisticsBaseFeeRwf("bike"))
})

test("Infinity and NaN distance → finite fallback base fee", () => {
  assert.equal(quoteGrandmaLogisticsFeeRwf("moto", Number.POSITIVE_INFINITY), grandmaLogisticsBaseFeeRwf("moto"))
  assert.equal(quoteGrandmaLogisticsFeeRwf("human", Number.NaN), grandmaLogisticsBaseFeeRwf("human"))
  assert.equal(formatGrandmaDistanceKm(Number.POSITIVE_INFINITY), "—")
  assert.equal(formatGrandmaDistanceKm(Number.NaN), "—")
})

test("pickup is 0 and takeaway uses configured takeaway fee", () => {
  assert.equal(quoteGrandmaFulfillmentFeeRwf("pickup", "moto", 2), 0)
  assert.equal(quoteGrandmaFulfillmentFeeRwf("takeaway", "moto", 2), GRANDMA_TAKEAWAY_FEE_RWF)
})

test("valid GPS replaces fallback with Haversine price", () => {
  const fallback = quoteGrandmaLogisticsFeeRwf("moto", null)
  assert.equal(fallback, grandmaLogisticsBaseFeeRwf("moto"))
  const seller = sellerNorthOf(2)
  const km = grandmaDeliveryDistanceKm(CUSTOMER.lat, CUSTOMER.lng, seller.lat, seller.lng)
  const live = quoteGrandmaLogisticsFeeRwf("moto", km)
  assert.ok(km != null)
  assert.ok(live > fallback)
  assert.equal(
    live,
    Math.round(GRANDMA_LOGISTICS_RATES.moto.baseRwf + GRANDMA_LOGISTICS_RATES.moto.rwfPerKm * km!),
  )
})

test("fees follow configured base + per-km and stay finite", () => {
  const distances = [0.1, 0.6, 1, 2, 5, 10]
  const modes = ["human", "bike", "moto"] as const
  for (const mode of modes) {
    const fees = distances.map((d) => quoteGrandmaLogisticsFeeRwf(mode, d))
    for (const fee of fees) {
      assert.ok(Number.isFinite(fee) && fee > 0, `${mode}`)
    }
    for (let i = 1; i < fees.length; i++) {
      assert.ok(fees[i]! >= fees[i - 1]!, `${mode} should not get cheaper at ${distances[i]}km`)
    }
  }
})

test("no screenshot constants or Math.random in logistics pricing source", () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "grandma-logistics-pricing.ts"), "utf8")
  assert.equal(src.includes("202"), false)
  assert.equal(src.includes("267"), false)
  assert.equal(src.includes("339"), false)
  assert.equal(src.includes("Math.random"), false)
})
