import test from "node:test"
import assert from "node:assert/strict"
import {
  resolveGrandmaCategory,
  resolveSellerDisplayCategory,
  shopCategoryToSectorSlug,
  GRANDMA_CATEGORY_TO_SECTOR_SLUG,
  GRANDMA_REGISTRATION_CATEGORY_VALUES,
  grandmaNavCategories,
  grandmaOthersChildCategories,
  isKnownGrandmaCategoryInput,
  isOthersChildCategory,
  isOthersHubCategory,
  displayGrandmaShopName,
  isPlaceholderGrandmaShopName,
} from "./seller-category-sector"

test("resolveGrandmaCategory maps pharmacy variants to Pharmacy, not Boutique", () => {
  assert.equal(resolveGrandmaCategory("pharmacy"), "Pharmacy")
  assert.equal(resolveGrandmaCategory("Pharmacy"), "Pharmacy")
  assert.equal(resolveGrandmaCategory("PHARMACY"), "Pharmacy")
  assert.equal(resolveGrandmaCategory("pharmacie"), "Pharmacy")
  assert.equal(resolveGrandmaCategory("farumasi"), "Pharmacy")
  assert.equal(resolveGrandmaCategory("pharma"), "Pharmacy")
})

test("resolveGrandmaCategory maps other sectors", () => {
  assert.equal(resolveGrandmaCategory("boutique"), "Boutique")
  assert.equal(resolveGrandmaCategory("supermarket"), "Supermarket")
  assert.equal(resolveGrandmaCategory("restaurant"), "Restaurant")
  assert.equal(resolveGrandmaCategory("bar-resto"), "Restaurant")
  assert.equal(resolveGrandmaCategory("liquor-store"), "Liquor Store")
  assert.equal(resolveGrandmaCategory("coffee-shop"), "Bakery")
  assert.equal(resolveGrandmaCategory("veterinary"), "Veterinary")
})

test("electronics is Electronics, not Others or Boutique", () => {
  assert.equal(resolveGrandmaCategory("electronics"), "Electronics")
  assert.equal(GRANDMA_CATEGORY_TO_SECTOR_SLUG.Electronics, "electronics")
  assert.equal(shopCategoryToSectorSlug("electronics"), "electronics")
})

test("new Grandma categories resolve from slug and registration labels", () => {
  assert.equal(resolveGrandmaCategory("home-supplies"), "Home Supplies")
  assert.equal(resolveGrandmaCategory("home supplies"), "Home Supplies")
  assert.equal(resolveGrandmaCategory("building-materials"), "Building Materials")
  assert.equal(resolveGrandmaCategory("hardware"), "Building Materials")
  assert.equal(resolveGrandmaCategory("auto-parts"), "Auto Parts")
  assert.equal(resolveGrandmaCategory("auto parts"), "Auto Parts")
  assert.equal(resolveGrandmaCategory("other"), "Others")
})

test("unknown category is Others, not Boutique", () => {
  assert.equal(resolveGrandmaCategory(""), "Others")
  assert.equal(resolveGrandmaCategory("unknown-sector-xyz"), "Others")
})

test("registration values cover new categories", () => {
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("electronics"))
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("home supplies"))
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("building materials"))
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("auto parts"))
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("other"))
  assert.ok(GRANDMA_REGISTRATION_CATEGORY_VALUES.includes("veterinary"))
})

test("home nav is the original eight; nested four live under Others / Ibindi", () => {
  const nav = grandmaNavCategories().map((c) => c.slug)
  assert.deepEqual(nav, [
    "boutique",
    "supermarket",
    "pharmacy",
    "restaurant",
    "liquor-store",
    "coffee-shop",
    "veterinary",
    "others",
  ])
  assert.equal(nav.includes("electronics"), false)
  const nested = grandmaOthersChildCategories().map((c) => c.slug)
  assert.deepEqual(nested, ["electronics", "home-supplies", "building-materials", "auto-parts"])
  assert.equal(isOthersChildCategory("Electronics"), true)
  assert.equal(isOthersChildCategory("Boutique"), false)
  assert.equal(isOthersHubCategory("Others"), true)
  assert.equal(isOthersHubCategory("Ibindi"), true)
  assert.equal(isOthersHubCategory("Electronics"), false)
})

test("PREFEREDCATEGORIES boutique is Boutique even when the shop name is a pharmacy", () => {
  assert.equal(
    resolveSellerDisplayCategory("boutique", "", "PHARMACIE UNIQUE"),
    "Boutique",
  )
  assert.equal(
    resolveSellerDisplayCategory("boutique", "pharmacy", "PHARMACIE UNIQUE"),
    "Boutique",
  )
})

test("explicit pharmacy PREFEREDCATEGORIES is Pharmacy", () => {
  assert.equal(resolveSellerDisplayCategory("pharmacy", "boutique", "My Shop"), "Pharmacy")
  assert.equal(resolveSellerDisplayCategory("pharmacie", "", ""), "Pharmacy")
})

test("DEPARTMENT is used only when PREFEREDCATEGORIES is empty", () => {
  assert.equal(resolveSellerDisplayCategory("", "pharmacy", "Corner Boutique"), "Pharmacy")
  assert.equal(resolveSellerDisplayCategory("   ", "electronics", ""), "Electronics")
})

test("shop name is used only when both category fields are empty", () => {
  assert.equal(resolveSellerDisplayCategory("", "", "pharmacy"), "Pharmacy")
  assert.equal(resolveSellerDisplayCategory("", "", "electronics"), "Electronics")
  // A shop named like a pharmacy is not reclassified unless PREFEREDCATEGORIES/DEPARTMENT say so.
  assert.equal(resolveSellerDisplayCategory("", "", "PHARMACIE UNIQUE"), "Others")
})

test("unknown category input is rejected; known aliases are accepted", () => {
  assert.equal(isKnownGrandmaCategoryInput("mechanics"), false)
  assert.equal(isKnownGrandmaCategoryInput("car-wash"), false)
  assert.equal(isKnownGrandmaCategoryInput("pharmacy"), true)
  assert.equal(isKnownGrandmaCategoryInput("hardware"), true)
  assert.equal(isKnownGrandmaCategoryInput("other"), true)
  assert.equal(isKnownGrandmaCategoryInput("Electronics"), true)
  assert.equal(isKnownGrandmaCategoryInput(""), true)
})

test("literal shop name null falls back to owner then account", () => {
  assert.equal(displayGrandmaShopName("null", "PHARMACIE UNIQUE", "ACC1"), "PHARMACIE UNIQUE")
  assert.equal(displayGrandmaShopName("null", "null", "ACC1"), "ACC1")
  assert.equal(displayGrandmaShopName("Real Shop", "Owner", "ACC1"), "Real Shop")
})

test("placeholder shop names are rejected for new registration", () => {
  assert.equal(isPlaceholderGrandmaShopName("null"), true)
  assert.equal(isPlaceholderGrandmaShopName("NULL"), true)
  assert.equal(isPlaceholderGrandmaShopName("  "), true)
  assert.equal(isPlaceholderGrandmaShopName("PHARMACIE UNIQUE"), false)
})
