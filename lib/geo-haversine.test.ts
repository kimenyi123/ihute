/**
 * Near Me geometry: same-point, radius gate, invalid/missing coords, nearest-first.
 * Does not change the Haversine formula.
 * Run: npx tsx --test lib/geo-haversine.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import { haversineKm, isValidLatLng, normalizeSupplierLatLng } from "./geo-haversine"
import { shopWithinNearMeRadius } from "./grandma-search"

const ORIGIN = { lat: -1.9441, lng: 30.0619 }

test("same-coordinate distance is 0", () => {
  assert.equal(haversineKm(ORIGIN.lat, ORIGIN.lng, ORIGIN.lat, ORIGIN.lng), 0)
})

test("missing and invalid coordinates are rejected", () => {
  assert.equal(isValidLatLng(undefined, undefined), false)
  assert.equal(isValidLatLng(null, null), false)
  assert.equal(isValidLatLng(ORIGIN.lat, undefined), false)
  assert.equal(isValidLatLng("", ""), false)
  assert.equal(isValidLatLng("  ", "30"), false)
  assert.equal(isValidLatLng("abc", ORIGIN.lng), false)
  assert.equal(isValidLatLng(Number.NaN, ORIGIN.lng), false)
  assert.equal(isValidLatLng(Number.POSITIVE_INFINITY, ORIGIN.lng), false)
  assert.equal(isValidLatLng(Number.NEGATIVE_INFINITY, ORIGIN.lng), false)
  assert.equal(isValidLatLng(91, ORIGIN.lng), false)
  assert.equal(isValidLatLng(-91, ORIGIN.lng), false)
  assert.equal(isValidLatLng(ORIGIN.lat, 181), false)
  assert.equal(isValidLatLng(ORIGIN.lat, -181), false)
  assert.equal(isValidLatLng(ORIGIN.lat, ORIGIN.lng), true)
  assert.equal(isValidLatLng("-1.94", "30.06"), true)
})

test("radius 1 vs 5: outside-radius seller dropped; nearer kept; nearest first", () => {
  const near = { lat: -1.946, lng: 30.063 }
  const mid = { lat: -1.96, lng: 30.07 }
  const far = { lat: -2.02, lng: 30.12 }
  const shops = [
    { id: "far", d: haversineKm(ORIGIN.lat, ORIGIN.lng, far.lat, far.lng) },
    { id: "near", d: haversineKm(ORIGIN.lat, ORIGIN.lng, near.lat, near.lng) },
    { id: "mid", d: haversineKm(ORIGIN.lat, ORIGIN.lng, mid.lat, mid.lng) },
    { id: "here", d: haversineKm(ORIGIN.lat, ORIGIN.lng, ORIGIN.lat, ORIGIN.lng) },
  ]
  assert.ok(shops[1]!.d < 1, `near ${shops[1]!.d}`)
  assert.ok(shops[2]!.d > 1 && shops[2]!.d < 5, `mid ${shops[2]!.d}`)
  assert.ok(shops[3]!.d === 0)
  assert.ok(shops[0]!.d > 5, `far ${shops[0]!.d}`)

  const in1 = shops.filter((s) => shopWithinNearMeRadius(s.d, { nearMe: true, radiusKm: 1 }))
  const in5 = shops.filter((s) => shopWithinNearMeRadius(s.d, { nearMe: true, radiusKm: 5 }))
  assert.equal(in1.some((s) => s.id === "far" || s.id === "mid"), false)
  assert.ok(in1.some((s) => s.id === "near"))
  assert.ok(in1.some((s) => s.id === "here"))
  assert.ok(in5.length >= in1.length)
  assert.ok(in5.some((s) => s.id === "mid"))
  assert.equal(in5.some((s) => s.id === "far"), false)

  const sorted = [...in5].sort((a, b) => a.d - b.d)
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i]!.d >= sorted[i - 1]!.d)
  }
  assert.equal(sorted[0]!.id, "here")
})

test("normalizeSupplierLatLng fixes common Rwanda column swap", () => {
  const norm = normalizeSupplierLatLng(30.107185309445597, -1.9450592407323903)
  assert.ok(norm)
  assert.ok(norm!.lat < 0 && norm!.lng > 0)
  assert.ok(haversineKm(-1.9536, 30.0606, norm!.lat, norm!.lng) < 10)
})
