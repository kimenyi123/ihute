/**
 * Regression tests: Grandma GPS must not silently disappear from payload / API extract / persist columns.
 * Run: npx tsx --test lib/grandma-seller-gps-payload.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  GRANDMA_GPS_PERSIST_COLUMNS,
  buildGrandmaSellerGpsPayload,
  extractGpsFromRegistrationBody,
} from "./grandma-seller-gps-payload"
import { encodeGeohash } from "./grandma-seller-gps"

test("GPS payload includes dual field names + accuracy", () => {
  const payload = buildGrandmaSellerGpsPayload({
    latitude: -1.9536,
    longitude: 30.0906,
    gpsAccuracy: 12.5,
    capturedAt: new Date("2026-08-13T12:00:00.000Z"),
  })
  assert.ok(payload)
  assert.equal(payload!.latitude, -1.9536)
  assert.equal(payload!.longitude, 30.0906)
  assert.equal(payload!.supplier_latitude, -1.9536)
  assert.equal(payload!.supplier_longitude, 30.0906)
  assert.equal(payload!.gpsAccuracy, 12.5)
  assert.equal(payload!.gps_accuracy, 12.5)
  assert.equal(payload!.location_source, "AUTO")
  assert.equal(payload!.gps_last_updated, "2026-08-13T12:00:00.000Z")
})

test("GPS payload is null when coordinates missing (no fake zeros)", () => {
  assert.equal(buildGrandmaSellerGpsPayload({ latitude: null, longitude: null }), null)
  assert.equal(buildGrandmaSellerGpsPayload({ latitude: 0, longitude: 0 }), null)
  assert.equal(buildGrandmaSellerGpsPayload({ latitude: NaN, longitude: 30 }), null)
})

test("API extract accepts latitude aliases and supplier_* names", () => {
  const a = extractGpsFromRegistrationBody({ latitude: -1.9, longitude: 30.1, gpsAccuracy: 8 })
  assert.deepEqual(a, { latitude: -1.9, longitude: 30.1, gpsAccuracy: 8 })

  const b = extractGpsFromRegistrationBody({
    supplier_latitude: -1.8,
    supplier_longitude: 30.2,
    gps_accuracy: 15,
  })
  assert.deepEqual(b, { latitude: -1.8, longitude: 30.2, gpsAccuracy: 15 })
})

test("API extract rejects missing GPS without inventing coordinates", () => {
  assert.equal(extractGpsFromRegistrationBody({}), null)
  assert.equal(extractGpsFromRegistrationBody({ latitude: 0, longitude: 0 }), null)
})

test("geohash generated for valid coordinates", () => {
  const h = encodeGeohash(-1.9536, 30.0906, 8)
  assert.equal(h.length, 8)
})

test("persist column contract includes supplier_* + accuracy + geohash", () => {
  assert.ok(GRANDMA_GPS_PERSIST_COLUMNS.includes("supplier_latitude"))
  assert.ok(GRANDMA_GPS_PERSIST_COLUMNS.includes("supplier_longitude"))
  assert.ok(GRANDMA_GPS_PERSIST_COLUMNS.includes("supplier_geohash"))
  assert.ok(GRANDMA_GPS_PERSIST_COLUMNS.includes("gps_accuracy"))
  assert.ok(GRANDMA_GPS_PERSIST_COLUMNS.includes("gps_last_updated"))
})
