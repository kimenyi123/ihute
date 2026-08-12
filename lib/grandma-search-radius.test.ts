import test from "node:test"
import assert from "node:assert/strict"
import {
  GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM,
  GRANDMA_NEAR_ME_RADIUS_OPTIONS_KM,
  maxFiniteDistanceKm,
  parseGrandmaSearchRadiusKm,
  shopWithinNearMeRadius,
} from "./grandma-search"

test("default Near Me radius is 1 km", () => {
  assert.equal(GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM, 1)
})

test("radius options start with 1 km then 5/10/25/50", () => {
  assert.deepEqual([...GRANDMA_NEAR_ME_RADIUS_OPTIONS_KM], [1, 5, 10, 25, 50])
})

test("parseGrandmaSearchRadiusKm: numeric options including 1", () => {
  assert.equal(parseGrandmaSearchRadiusKm("1"), 1)
  assert.equal(parseGrandmaSearchRadiusKm("5"), 5)
  assert.equal(parseGrandmaSearchRadiusKm("10"), 10)
  assert.equal(parseGrandmaSearchRadiusKm("25"), 25)
  assert.equal(parseGrandmaSearchRadiusKm("50"), 50)
})

test("parseGrandmaSearchRadiusKm: all / empty → null (no distance cap)", () => {
  assert.equal(parseGrandmaSearchRadiusKm("all"), null)
  assert.equal(parseGrandmaSearchRadiusKm("ALL"), null)
  assert.equal(parseGrandmaSearchRadiusKm(""), null)
  assert.equal(parseGrandmaSearchRadiusKm(null), null)
})

test("parseGrandmaSearchRadiusKm: invalid → default 1 km", () => {
  assert.equal(parseGrandmaSearchRadiusKm("nope"), 1)
  assert.equal(parseGrandmaSearchRadiusKm("0"), 1)
  assert.equal(parseGrandmaSearchRadiusKm("-3"), 1)
  assert.equal(parseGrandmaSearchRadiusKm("nope"), GRANDMA_NEAR_ME_DEFAULT_RADIUS_KM)
})

test("shopWithinNearMeRadius filters by radius and excludes unknown distance", () => {
  assert.equal(shopWithinNearMeRadius(0.5, { nearMe: true, radiusKm: 1 }), true)
  assert.equal(shopWithinNearMeRadius(1.04, { nearMe: true, radiusKm: 1 }), true)
  assert.equal(shopWithinNearMeRadius(1.2, { nearMe: true, radiusKm: 1 }), false)
  assert.equal(shopWithinNearMeRadius(3, { nearMe: true, radiusKm: 5 }), true)
  assert.equal(shopWithinNearMeRadius(5.04, { nearMe: true, radiusKm: 5 }), true)
  assert.equal(shopWithinNearMeRadius(5.2, { nearMe: true, radiusKm: 5 }), false)
  assert.equal(shopWithinNearMeRadius(12, { nearMe: true, radiusKm: 10 }), false)
  assert.equal(shopWithinNearMeRadius(12, { nearMe: true, radiusKm: 25 }), true)
  assert.equal(shopWithinNearMeRadius(999, { nearMe: true, radiusKm: null }), true)
  assert.equal(shopWithinNearMeRadius(Infinity, { nearMe: true, radiusKm: 1 }), false)
  assert.equal(shopWithinNearMeRadius(null, { nearMe: true, radiusKm: 1 }), false)
  assert.equal(shopWithinNearMeRadius(100, { nearMe: false, radiusKm: 1 }), true)
})

test("maxFiniteDistanceKm ignores non-finite", () => {
  assert.equal(maxFiniteDistanceKm([1.2, null, Infinity, 4.5, undefined]), 4.5)
  assert.equal(maxFiniteDistanceKm([Infinity, null]), null)
})

test("radius ladder changes membership (1 vs 5 vs 10 vs 25 vs all)", () => {
  const shops = [0.4, 1.0, 4.9, 7.5, 18, 40]
  const count = (r: number | null) =>
    shops.filter((d) => shopWithinNearMeRadius(d, { nearMe: true, radiusKm: r })).length
  assert.equal(count(1), 2)
  assert.equal(count(5), 3)
  assert.equal(count(10), 4)
  assert.equal(count(25), 5)
  assert.equal(count(50), 6)
  assert.equal(count(null), 6)
})
