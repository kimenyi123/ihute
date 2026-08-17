/**
 * Grandma Java-backed search (no Next.js MySQL, no fetchSuggestions).
 * Run: npx tsx --test lib/grandma-search-java.test.ts
 */
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { haversineKm } from "./geo-haversine"
import { runGrandmaSearch, setGrandmaJavaFetchForTests } from "./grandma-search-java"

const CUSTOMER = { lat: -1.9536, lng: 30.0906 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function nearbySeller(kmNorth: number) {
  const dLat = kmNorth / 111.32
  return {
    ISHYIGA_ACCOUNT: "ALG0001",
    seller_account: "ALG0001",
    nickname: "Corner Store",
    OWNER: "Emille",
    seller_name: "Emille",
    PREFEREDCATEGORIES: "boutique",
    momo: "0780000000",
    supplier_latitude: CUSTOMER.lat + dLat,
    supplier_longitude: CUSTOMER.lng,
    ITEM_NAME: "UHT WHOLE MILK 500ML",
  }
}

function installMock(opts?: { shops?: unknown[]; suggestions?: string[]; failJava?: boolean; status?: number }) {
  const shops = opts?.shops ?? [nearbySeller(0.6)]
  const suggestions = opts?.suggestions ?? ["UHT WHOLE MILK 500ML", "Corner Store"]
  const urls: string[] = []
  setGrandmaJavaFetchForTests(async (url) => {
    urls.push(String(url))
    if (opts?.failJava) throw new Error("ECONNREFUSED")
    const u = String(url)
    if (u.includes("fetchSuggestions") || u.includes("sectorListSuppliers") || u.includes("suppliers/browse")) {
      return jsonResponse({ error: "wrong-endpoint" }, 500)
    }
    if (u.includes("grandma/search")) {
      if (opts?.status) return jsonResponse({ ok: false, error: "down" }, opts.status)
      if (u.includes("suggest=1")) {
        return jsonResponse({ ok: true, shops: [], suggestions })
      }
      return jsonResponse({ ok: true, shops, suggestions })
    }
    return jsonResponse({ ok: false, error: "unknown" }, 404)
  })
  return urls
}

test.afterEach(() => {
  setGrandmaJavaFetchForTests(null)
})

test("valid GPS yields Haversine distance and Java-backed shop hit", async () => {
  installMock()
  const r = await runGrandmaSearch({
    q: "milk",
    sector: "boutique",
    lat: CUSTOMER.lat,
    lng: CUSTOMER.lng,
    pageSize: 10,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.source, "java")
  assert.ok(r.shops.length >= 1)
  const shop = r.shops[0]!
  assert.equal(shop.sellerAccount, "ALG0001")
  assert.ok(shop.distanceKm != null && Number.isFinite(shop.distanceKm))
  const expected = haversineKm(
    CUSTOMER.lat,
    CUSTOMER.lng,
    nearbySeller(0.6).supplier_latitude,
    nearbySeller(0.6).supplier_longitude,
  )
  assert.ok(Math.abs((shop.distanceKm ?? 0) - expected) < 0.15)
  assert.ok(shop.score > 0)
})

test("missing customer GPS still returns a finite shop list", async () => {
  installMock()
  const r = await runGrandmaSearch({ q: "milk", sector: "boutique", pageSize: 10 })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.ok(r.shops.length >= 1)
  assert.equal(r.shops[0]!.distanceKm, null)
})

test("Near Me radius keeps nearby shop and drops a far shop", async () => {
  const near = nearbySeller(0.4)
  const far = {
    ...nearbySeller(12),
    ISHYIGA_ACCOUNT: "ALG0002",
    seller_account: "ALG0002",
    nickname: "Far Mart",
  }
  installMock({ shops: [near, far] })
  const r = await runGrandmaSearch({
    q: "milk",
    sector: "boutique",
    lat: CUSTOMER.lat,
    lng: CUSTOMER.lng,
    nearMe: true,
    radiusKm: 1,
    pageSize: 10,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  const ids = r.shops.map((s) => s.sellerAccount)
  assert.ok(ids.includes("ALG0001"))
  assert.equal(ids.includes("ALG0002"), false)
})

test("prefix suggestOnly returns suggestions without ranking shops", async () => {
  const urls = installMock()
  const r = await runGrandmaSearch({
    q: "mil",
    sector: "boutique",
    suggest: true,
    suggestOnly: true,
    pageSize: 10,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.shops.length, 0)
  assert.ok(r.suggestions.some((s) => /milk|corner/i.test(s)))
  assert.equal(urls.length, 1)
  assert.ok(urls[0]!.includes("suggest=1"))
  assert.equal(urls.some((u) => u.includes("fetchSuggestions")), false)
})

test("no-sector product search is a single Java call", async () => {
  const urls = installMock()
  const r = await runGrandmaSearch({ q: "milk", pageSize: 10 })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(urls.length, 1)
  assert.ok(urls[0]!.includes("grandma/search"))
  assert.equal(urls[0]!.includes("fetchSuggestions"), false)
  assert.ok(r.shops.length >= 1)
})

test("Java unreachable returns a typed failure, not MYSQL_NOT_CONFIGURED", async () => {
  installMock({ failJava: true })
  const r = await runGrandmaSearch({ q: "milk", sector: "boutique" })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.code, "JAVA_UNREACHABLE")
})

test("Java 500 returns JAVA_UNREACHABLE", async () => {
  installMock({ status: 500 })
  const r = await runGrandmaSearch({ q: "milk", sector: "boutique" })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.code, "JAVA_UNREACHABLE")
})

test("pagination slices Java-ranked shops", async () => {
  const shops = Array.from({ length: 5 }, (_, i) => ({
    ...nearbySeller(0.2),
    ISHYIGA_ACCOUNT: `ALG${i}`,
    seller_account: `ALG${i}`,
    nickname: `Milk Shop ${i}`,
  }))
  installMock({ shops })
  const p1 = await runGrandmaSearch({ q: "milk", sector: "boutique", page: 1, pageSize: 2 })
  const p2 = await runGrandmaSearch({ q: "milk", sector: "boutique", page: 2, pageSize: 2 })
  assert.equal(p1.ok && p2.ok, true)
  if (!p1.ok || !p2.ok) return
  assert.equal(p1.shops.length, 2)
  assert.equal(p1.hasMore, true)
  assert.ok(p2.shops[0]!.sellerAccount !== p1.shops[0]!.sellerAccount)
})

test("java search source has no MySQL env, fetchSuggestions, or Math.random", () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "grandma-search-java.ts"), "utf8")
  assert.equal(src.includes("ONBOARDING_MYSQL"), false)
  assert.equal(src.includes("getOnboardingMysqlConfig"), false)
  assert.equal(src.includes("createPool"), false)
  assert.equal(src.includes("Math.random"), false)
  assert.equal(src.includes("mysql2"), false)
  assert.equal(src.includes("getFetchSuggestionsUrl"), false)
  assert.equal(/\/Kaos\/fetchSuggestions/.test(src), false)
  assert.equal(src.includes("sectorListSuppliers"), false)
})

test("search route does not import MySQL", () => {
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "api", "grandma", "search", "route.ts"),
    "utf8",
  )
  assert.equal(src.includes("grandma-search-mysql"), false)
  assert.equal(src.includes("getOnboardingMysqlConfig"), false)
  assert.equal(src.includes("ONBOARDING_MYSQL"), false)
  assert.equal(src.includes("mysql2"), false)
  assert.ok(src.includes("grandma-search-java"))
})
