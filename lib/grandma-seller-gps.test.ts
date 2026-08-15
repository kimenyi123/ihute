/**
 * Unit tests for Grandma seller GPS helpers (no network / DB).
 * Run: npx tsx --test lib/grandma-seller-gps.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  classifyBrowserGpsError,
  encodeGeohash,
  isShopGpsInRwanda,
  normalizeGpsAccuracyForDb,
} from "./grandma-seller-gps"
import { toClientGpsPersistStatus } from "./grandma-seller-gps-client-status"

test("isShopGpsInRwanda accepts Kigali", () => {
  assert.equal(isShopGpsInRwanda(-1.9536, 30.0906), true)
})

test("isShopGpsInRwanda rejects far coordinates", () => {
  assert.equal(isShopGpsInRwanda(48.8566, 2.3522), false)
  assert.equal(isShopGpsInRwanda(NaN, 30), false)
})

test("encodeGeohash produces stable Rwanda-length hash", () => {
  const h = encodeGeohash(-1.9536, 30.0906, 8)
  assert.equal(h.length, 8)
  assert.match(h, /^[0-9bcdefghjkmnpqrstuvwxyz]+$/)
  assert.equal(encodeGeohash(-1.9536, 30.0906, 8), h)
  assert.equal(encodeGeohash(NaN, 30), "")
})

test("classifyBrowserGpsError maps codes", () => {
  const denied = {
    code: 1,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message: "x",
    name: "x",
  }
  const unavailable = {
    code: 2,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message: "x",
    name: "x",
  }
  const timeout = {
    code: 3,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message: "x",
    name: "x",
  }
  assert.equal(classifyBrowserGpsError(denied as GeolocationPositionError), "denied")
  assert.equal(classifyBrowserGpsError(unavailable as GeolocationPositionError), "unavailable")
  assert.equal(classifyBrowserGpsError(timeout as GeolocationPositionError), "timeout")
  assert.equal(classifyBrowserGpsError(null), "unknown")
})

test("toClientGpsPersistStatus success is explicit", () => {
  assert.deepEqual(toClientGpsPersistStatus({ ok: true, updatedSeller: 1, updatedSignup: 1 }), {
    ok: true,
    skipped: false,
    reason: null,
  })
})

test("toClientGpsPersistStatus hides MySQL config details when skipped", () => {
  const client = toClientGpsPersistStatus({
    ok: false,
    skipped: true,
    error: "ONBOARDING_MYSQL_* is not configured",
  })
  assert.equal(client.ok, false)
  assert.equal(client.skipped, true)
  assert.equal(client.reason, "GPS persistence database is not configured")
  assert.equal(client.reason?.includes("ONBOARDING"), false)
  assert.equal(client.reason?.includes("PASSWORD"), false)
})

test("toClientGpsPersistStatus sanitizes hard failures", () => {
  const client = toClientGpsPersistStatus({
    ok: false,
    skipped: false,
    error: "ECONNREFUSED 127.0.0.1:3306 user=root",
  })
  assert.deepEqual(client, {
    ok: false,
    skipped: false,
    reason: "GPS persistence failed",
  })
})

test("toClientGpsPersistStatus handles missing result", () => {
  assert.deepEqual(toClientGpsPersistStatus(null), {
    ok: false,
    skipped: true,
    reason: "GPS persistence did not run",
  })
})

test("normalizeGpsAccuracyForDb keeps in-range meters", () => {
  assert.equal(normalizeGpsAccuracyForDb(20.5), 20.5)
  assert.equal(normalizeGpsAccuracyForDb(1500), 1500)
  assert.equal(normalizeGpsAccuracyForDb(9999.99), 9999.99)
})

test("normalizeGpsAccuracyForDb stores overflow / invalid as null (never fake GPS)", () => {
  assert.equal(normalizeGpsAccuracyForDb(10000), null)
  assert.equal(normalizeGpsAccuracyForDb(20000), null)
  assert.equal(normalizeGpsAccuracyForDb(NaN), null)
  assert.equal(normalizeGpsAccuracyForDb(Infinity), null)
  assert.equal(normalizeGpsAccuracyForDb(null), null)
  assert.equal(normalizeGpsAccuracyForDb(-1), null)
})
