import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { dedupeSearchProductsByItemCodeAndSellingPrice } from "./dedupe-search-products"
import { filterProductsByRelevance, filterSuppliersByRelevance } from "./search-utils"

test("exact product code survives low heuristic relevance", () => {
  const result = filterProductsByRelevance(
    [{ item_code: "N-22", item_commercial_name: "Nescafe", item_key_words: "coffee" }],
    "N-22",
    15,
  )
  assert.equal(result.length, 1)
  assert.equal(result[0]?.item_code, "N-22")
})

test("dedupe keeps different suppliers and prices distinct", () => {
  const result = dedupeSearchProductsByItemCodeAndSellingPrice([
    { item_code: "MILK-1", supplier_account: "A", selling_price: 100 },
    { item_code: "MILK-1", supplier_account: "A", selling_price: 100 },
    { item_code: "MILK-1", supplier_account: "A", selling_price: 120 },
    { item_code: "MILK-1", supplier_account: "B", selling_price: 100 },
  ]) as Array<Record<string, unknown>>
  assert.equal(result.length, 3)
  assert.deepEqual(
    result.map((row) => `${row.supplier_account}:${row.selling_price}`),
    ["A:100", "A:120", "B:100"],
  )
})

test("supplier nickname/account can remain searchable when display name is missing", () => {
  const result = filterSuppliersByRelevance(
    [{ supplier_account: "SHOP-1", supplier_name: "Shop One" }],
    "shop one",
    5,
  )
  assert.equal(result.length, 1)
  assert.equal(result[0]?.supplier_account, "SHOP-1")
})

test("Java supplier product search is not pharmacy-only", () => {
  const source = readFileSync(
    join(process.cwd(), "..", "java backend", "src", "java", "Kaos", "fetchSuggestions.java"),
    "utf8",
  )
  assert.equal(source.includes("PREFEREDCATEGORIES='pharmacy'"), false)
})
