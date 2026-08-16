/**
 * Grandma search intelligence: typos, join/split, synonyms, short-query safety.
 * Run: npx tsx --test lib/grandma-search-intelligence.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildGrandmaFulltextBooleanQueries,
  buildGrandmaSearchLikePatterns,
  buildGrandmaTypoLikePatterns,
  clampGrandmaSearchQuery,
  collapseRepeatedLetters,
  damerauLevenshtein,
  grandmaSearchLexemes,
  grandmaSearchRadiusParamError,
  isRelevantGrandmaSearchHit,
  isStrongFuzzyTokenMatch,
  joinSearchTokens,
  normalizeSearchText,
  rankGrandmaSearchHit,
  GRANDMA_SEARCH_MIN_SCORE,
  GRANDMA_PUBLIC_SEARCH_UNAVAILABLE,
  GRANDMA_PUBLIC_NEARME_UNAVAILABLE,
  GRANDMA_PUBLIC_GPS_PERMISSION,
  GRANDMA_PUBLIC_NO_NEARBY,
  GRANDMA_PUBLIC_INVALID_SEARCH,
  isTechnicalGrandmaErrorText,
  maxEditDistanceForLength,
} from "./grandma-search"

const chapatiRow = {
  shopName: "Mama Nadia",
  productBlob: "Beef Chapati Wrap",
  category: "Boutique",
  description: "Corner shop drinks and bread",
}
const pharmacyRow = {
  shopName: "Rite Pharmacy",
  productBlob: "pharmacy",
  category: "Pharmacy",
}
const phoneRow = {
  shopName: "Phone Hub",
  productBlob: "iphone 13 case",
  category: "Electronics",
}
const shoeRow = {
  shopName: "City Mart",
  productBlob: "leather shoes",
  category: "Boutique",
}
const milkRow = {
  shopName: "Corner Store",
  productBlob: "UHT WHOLE MILK 500ML",
  category: "Boutique",
}
const amataRow = {
  shopName: "Iduka",
  productBlob: "amata meza 1L",
  category: "Boutique",
}
const cementRow = {
  shopName: "Hardware",
  productBlob: "cement 50kg",
  category: "Building materials",
}

function kept(q: string, row: Parameters<typeof rankGrandmaSearchHit>[1]) {
  const r = rankGrandmaSearchHit(q, row)
  return { ...r, keep: isRelevantGrandmaSearchHit(r.score, q, r.tier) }
}

test("normalize: case, punctuation, accents, whitespace", () => {
  assert.equal(normalizeSearchText("  CHAPATI!! "), "chapati")
  assert.equal(normalizeSearchText("café"), "cafe")
  assert.equal(normalizeSearchText("cha   pati"), "cha pati")
})

test("join and collapse variants", () => {
  assert.equal(joinSearchTokens("cha pati"), "chapati")
  assert.equal(collapseRepeatedLetters("chappatti"), "chapati")
  assert.equal(collapseRepeatedLetters("chapatiii"), "chapati")
  assert.equal(collapseRepeatedLetters("chappati"), "chapati")
  assert.ok(grandmaSearchLexemes("cha pati").includes("chapati"))
  assert.ok(grandmaSearchLexemes("chappatti").includes("chapati"))
})

test("Damerau transposition iphnoe → iphone is 1", () => {
  assert.equal(damerauLevenshtein("iphnoe", "iphone", 2), 1)
  assert.equal(isStrongFuzzyTokenMatch("iphnoe", "iphone"), true)
})

test("length-aware fuzzy: chapati family", () => {
  assert.equal(isStrongFuzzyTokenMatch("chapatti", "chapati"), true)
  assert.equal(isStrongFuzzyTokenMatch("chapty", "chapati"), true)
  assert.equal(isStrongFuzzyTokenMatch("chpati", "chapati"), true)
  assert.equal(isStrongFuzzyTokenMatch("chapti", "chapati"), true)
  assert.equal(isStrongFuzzyTokenMatch("xy", "chapati"), false)
})

test("exact chapati and CHAPATI keep intended product and outrank fuzzy", () => {
  const exact = kept("chapati", chapatiRow)
  const upper = kept("CHAPATI", chapatiRow)
  const typo = kept("chappatti", chapatiRow)
  assert.equal(exact.keep, true)
  assert.equal(exact.tier, "exact")
  assert.equal(upper.keep, true)
  assert.equal(typo.keep, true)
  assert.ok(exact.score > typo.score || typo.tier === "exact")
})

test("typo matrix finds chapati concept", () => {
  for (const q of [
    "chapati",
    "CHAPATI",
    "chapatti",
    "chappatti",
    "chapty",
    "chpati",
    "chapti",
    "cha pati",
    "chapatiii",
    "chappati",
  ]) {
    const r = kept(q, chapatiRow)
    assert.equal(r.keep, true, `${q} tier=${r.tier} score=${r.score}`)
  }
})

test("pharmacy typos and synonym pharmacie", () => {
  for (const q of ["pharmacy", "pharmcie", "pharmcy", "phamacy", "pharmacie"]) {
    const r = kept(q, pharmacyRow)
    assert.equal(r.keep, true, `${q} tier=${r.tier} score=${r.score}`)
  }
})

test("iphone typos including transposition", () => {
  for (const q of ["iphone", "iphnoe", "ipone", "iphine"]) {
    const r = kept(q, phoneRow)
    assert.equal(r.keep, true, `${q} tier=${r.tier} score=${r.score}`)
  }
})

test("shoes typos and footwear synonym", () => {
  for (const q of ["shoes", "shose", "shooes", "footwear"]) {
    const r = kept(q, shoeRow)
    assert.equal(r.keep, true, `${q} tier=${r.tier} score=${r.score}`)
  }
})

test("milk / milkk / amata synonym", () => {
  assert.equal(kept("milk", milkRow).keep, true)
  assert.equal(kept("milkk", milkRow).keep, true)
  assert.equal(kept("amata", milkRow).keep, true)
  assert.equal(kept("milk", amataRow).keep, true)
  assert.equal(kept("milk", milkRow).score >= kept("milkk", milkRow).score, true)
})

test("negatives stay empty", () => {
  for (const q of [
    "completelyrandomword",
    "completelyrandomnonexistentword",
    "xyznonexistent",
    "randomlongquerythatshouldnotmatchanything",
  ]) {
    const r = kept(q, chapatiRow)
    assert.equal(r.keep, false, q)
    assert.equal(kept(q, cementRow).keep, false, q)
  }
})

test("short queries do not keep weak fuzzy / prefix explosions", () => {
  assert.equal(kept("a", chapatiRow).keep, false)
  assert.equal(kept("ai", phoneRow).keep, false)
  assert.equal(kept("tv", cementRow).keep, false)
  const carHardware = kept("car", cementRow)
  assert.equal(carHardware.keep, false)
  const penHardware = kept("pen", cementRow)
  assert.equal(penHardware.keep, false)
})

test("product exact outranks description-only and incidental body milk is demoted not dropped", () => {
  const drink = rankGrandmaSearchHit("milk", milkRow)
  const body = rankGrandmaSearchHit("milk", {
    shopName: "Pharmacy",
    productBlob: "SEBAMED BODY MILK 200ML",
  })
  const desc = rankGrandmaSearchHit("milk", {
    shopName: "Hardware",
    description: "We also stock body milk lotion in aisle 4",
  })
  assert.ok(drink.score > body.score, `${drink.score} vs ${body.score}`)
  assert.equal(isRelevantGrandmaSearchHit(body.score, "milk", body.tier), true)
  assert.equal(isRelevantGrandmaSearchHit(desc.score, "milk", desc.tier), false)
  assert.ok(drink.score >= GRANDMA_SEARCH_MIN_SCORE)
})

test("phase-1 LIKE includes collapse, join, milk stem, pharmacy prefix, chapti insertion", () => {
  const chap = buildGrandmaSearchLikePatterns("chappatti")
  assert.ok(chap.some((p) => p.includes("chapati")), String(chap))
  const split = buildGrandmaSearchLikePatterns("cha pati")
  assert.ok(split.some((p) => p.includes("chapati") || p.includes("cha%pati")), String(split))
  const milk = buildGrandmaSearchLikePatterns("milkk")
  assert.ok(milk.some((p) => p.includes("milk")), String(milk))
  const pharm = buildGrandmaSearchLikePatterns("pharmcie")
  assert.ok(pharm.some((p) => p.includes("pharm")), String(pharm))
  const chapti = buildGrandmaSearchLikePatterns("chapti")
  assert.ok(
    chapti.some((p) => p.includes("chap_ti") || p.includes("cha_pti") || p.includes("ch_apti")),
    String(chapti),
  )
})


test("phase-2 typo LIKE includes iphone transposition of iphnoe", () => {
  const pats = buildGrandmaTypoLikePatterns("iphnoe")
  assert.ok(pats.some((p) => p.includes("iphone")), String(pats))
})

test("FULLTEXT still has milkk + milk stem separately", () => {
  const q = buildGrandmaFulltextBooleanQueries("milkk")
  assert.ok(q.some((x) => x.includes("milkk")), String(q))
  assert.ok(q.some((x) => x.includes("milk") && !x.includes("milkk")), String(q))
})

test("query clamp bounds length and token count", () => {
  const long = clampGrandmaSearchQuery("one two three four five six seven eight nine ten")
  assert.equal(long.split(" ").length <= 8, true)
  assert.ok(clampGrandmaSearchQuery("x".repeat(200)).length <= 80)
})

test("invalid radius param is 400-class, valid stays null error", () => {
  assert.equal(grandmaSearchRadiusParamError("nope"), "INVALID_RADIUS")
  assert.equal(grandmaSearchRadiusParamError("1"), null)
})

test("public search errors never mention MySQL or env namespaces", () => {
  assert.equal(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE, "Search is temporarily unavailable. Please try again shortly.")
  assert.equal(
    GRANDMA_PUBLIC_NEARME_UNAVAILABLE,
    "Location search is temporarily unavailable. Please try again shortly.",
  )
  assert.equal(GRANDMA_PUBLIC_GPS_PERMISSION, "Please allow location access to use Near Me.")
  assert.equal(GRANDMA_PUBLIC_NO_NEARBY, "No shops were found near your current location.")
  assert.equal(GRANDMA_PUBLIC_INVALID_SEARCH, "Please enter a product or shop name.")
  assert.equal(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE.includes("MYSQL"), false)
  assert.equal(GRANDMA_PUBLIC_NEARME_UNAVAILABLE.includes("MYSQL"), false)
  assert.equal(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE.toLowerCase().includes("onboarding"), false)
  assert.equal(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE.includes("ECONNREFUSED"), false)
  assert.equal(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE.includes("ER_ACCESS_DENIED"), false)
  assert.equal(isTechnicalGrandmaErrorText("MYSQL_NOT_CONFIGURED"), true)
  assert.equal(isTechnicalGrandmaErrorText("ECONNREFUSED 127.0.0.1"), true)
  assert.equal(isTechnicalGrandmaErrorText(GRANDMA_PUBLIC_SEARCH_UNAVAILABLE), false)
  assert.match(GRANDMA_PUBLIC_NEARME_UNAVAILABLE, /temporarily unavailable/i)
})

test("fuzzy edit budget: 1-2 none, 3-5 one, 6+ two", () => {
  assert.equal(maxEditDistanceForLength(1), 0)
  assert.equal(maxEditDistanceForLength(2), 0)
  assert.equal(maxEditDistanceForLength(3), 1)
  assert.equal(maxEditDistanceForLength(5), 1)
  assert.equal(maxEditDistanceForLength(6), 2)
  assert.equal(maxEditDistanceForLength(12), 2)
})
