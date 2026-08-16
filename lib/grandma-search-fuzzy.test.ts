import test from "node:test"
import assert from "node:assert/strict"
import { buildGrandmaSearchLikePatterns, buildGrandmaFulltextBooleanQueries, normalizeSearchText } from "./grandma-search"

test("milkk LIKE patterns include milk stem so SQL can retrieve milk rows", () => {
  const pats = buildGrandmaSearchLikePatterns("milkk")
  assert.ok(pats.some((p) => p.includes("milk")), String(pats))
  assert.ok(pats.some((p) => p.includes("milkk") || p.includes("milk")))
})

test("exact milk pattern is present", () => {
  const pats = buildGrandmaSearchLikePatterns("milk")
  assert.ok(pats.includes("%milk%"), String(pats))
})

test("punctuation is stripped before LIKE", () => {
  const pats = buildGrandmaSearchLikePatterns("  MILK!! ")
  assert.equal(normalizeSearchText("  MILK!! "), "milk")
  assert.ok(pats.includes("%milk%"), String(pats))
})

test("FULLTEXT candidate queries include milkk and milk stem separately", () => {
  const q = buildGrandmaFulltextBooleanQueries("milkk")
  assert.ok(q.some((x) => x.includes("milkk")), String(q))
  assert.ok(q.some((x) => x.includes("milk") && !x.includes("milkk")), String(q))
})

test("FULLTEXT milk query uses prefix BOOLEAN", () => {
  const q = buildGrandmaFulltextBooleanQueries("milk")
  assert.ok(q.some((x) => x.includes("+milk*")), String(q))
  assert.equal(q.some((x) => x === "+mil*"), false, String(q))
})

test("collapsed chappatti is offered as a FULLTEXT candidate", () => {
  const q = buildGrandmaFulltextBooleanQueries("chappatti")
  assert.ok(q.some((x) => x.includes("chapati")), String(q))
})
