import test from "node:test"
import assert from "node:assert/strict"
import { grandmaSectorLikePatterns } from "./seller-category-sector"

test("auto-parts filter does not match mechanics, garages, or generic auto", () => {
  const pats = grandmaSectorLikePatterns("auto-parts").map((p) => p.toLowerCase())
  assert.ok(pats.includes("%auto-parts%"))
  assert.ok(pats.includes("%spare-parts%") || pats.includes("%spare parts%"))
  assert.equal(pats.includes("%auto%"), false)
  assert.equal(pats.some((p) => p.includes("mechanic")), false)
  assert.equal(pats.some((p) => p.includes("garage")), false)
  assert.equal(pats.some((p) => p.includes("car wash") || p.includes("rental")), false)
})

test("building-materials does not match boutique, electronics, or auto-parts", () => {
  const pats = grandmaSectorLikePatterns("building-materials").map((p) => p.toLowerCase())
  assert.ok(pats.includes("%building-materials%"))
  assert.ok(pats.includes("%hardware%"))
  assert.equal(pats.some((p) => p.includes("boutique")), false)
  assert.equal(pats.some((p) => p.includes("electronics")), false)
  assert.equal(pats.some((p) => p.includes("auto-parts") || p.includes("mechanic")), false)
})

test("home-supplies and electronics stay distinct", () => {
  const home = grandmaSectorLikePatterns("home-supplies").join(" ").toLowerCase()
  const elec = grandmaSectorLikePatterns("electronics").join(" ").toLowerCase()
  assert.ok(home.includes("home-supplies") || home.includes("household"))
  assert.ok(elec.includes("electronics"))
  assert.equal(home.includes("electronics"), false)
  assert.equal(elec.includes("home-supplies"), false)
})
