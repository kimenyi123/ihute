import test from "node:test"
import assert from "node:assert/strict"
import {
  isRelevantGrandmaSearchHit,
  rankGrandmaSearchHit,
  GRANDMA_SEARCH_MIN_SCORE,
} from "./grandma-search"

test("exact product name outranks shop-name contains and category", () => {
  const product = rankGrandmaSearchHit("milk", {
    productBlob: "milk",
    shopName: "Corner Store",
  })
  const shop = rankGrandmaSearchHit("milk", {
    shopName: "Milk Mart",
    productBlob: "bread",
  })
  const category = rankGrandmaSearchHit("milk", {
    category: "milk",
    shopName: "Other",
  })
  assert.ok(product.score > shop.score)
  assert.ok(shop.score > category.score)
  assert.equal(product.tier, "exact")
})

test("whole-word product milk outranks substring-only and Americano misses", () => {
  const uht = rankGrandmaSearchHit("milk", {
    shopName: "INSTA SUPPLIERS LTD",
    productBlob: "TOP MILK UHT WHOLE MILK 500ML",
  })
  const americano = rankGrandmaSearchHit("milk", {
    shopName: "Cafe",
    productBlob: "Americano",
    description: "Hot drinks menu",
  })
  assert.ok(uht.score >= GRANDMA_SEARCH_MIN_SCORE)
  assert.equal(uht.tier, "exact")
  assert.equal(isRelevantGrandmaSearchHit(uht.score, "milk", uht.tier), true)
  assert.equal(isRelevantGrandmaSearchHit(americano.score, "milk", americano.tier), false)
})

test("description-only substring is below the relevance floor", () => {
  const hit = rankGrandmaSearchHit("milk", {
    shopName: "Hardware",
    description: "We also stock body milk lotion in aisle 4",
  })
  assert.equal(hit.tier, "description")
  assert.equal(isRelevantGrandmaSearchHit(hit.score, "milk", hit.tier), false)
})

test("shop-name token INSTA outranks product INSTANT prefix", () => {
  const shop = rankGrandmaSearchHit("insta", {
    shopName: "INSTA SUPPLIERS LTD",
    productBlob: "bread",
  })
  const instant = rankGrandmaSearchHit("insta", {
    shopName: "melia",
    productBlob: "INDOMIE INSTANT NOODLES CHICKEN FLAVOUR",
  })
  assert.ok(shop.score > instant.score, `${shop.score} vs ${instant.score}`)
})

test("empty query is always relevant (browse / Near Me)", () => {
  assert.equal(isRelevantGrandmaSearchHit(0, "", "none"), true)
})
