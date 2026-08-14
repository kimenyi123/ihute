import test from "node:test"
import assert from "node:assert/strict"
import { classifyBrowserGpsError, isShopGpsInRwanda } from "./grandma-seller-gps"

test("isShopGpsInRwanda accepts Kigali", () => {
  assert.equal(isShopGpsInRwanda(-1.9536, 30.0906), true)
})

test("isShopGpsInRwanda rejects far coordinates", () => {
  assert.equal(isShopGpsInRwanda(48.8566, 2.3522), false)
  assert.equal(isShopGpsInRwanda(NaN, 30), false)
})

test("classifyBrowserGpsError maps codes", () => {
  const denied = { code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "x", name: "x" }
  const unavailable = { code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "x", name: "x" }
  const timeout = { code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "x", name: "x" }
  assert.equal(classifyBrowserGpsError(denied as GeolocationPositionError), "denied")
  assert.equal(classifyBrowserGpsError(unavailable as GeolocationPositionError), "unavailable")
  assert.equal(classifyBrowserGpsError(timeout as GeolocationPositionError), "timeout")
  assert.equal(classifyBrowserGpsError(null), "unknown")
})
