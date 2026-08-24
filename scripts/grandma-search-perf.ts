/**
 * Grandma Search performance benchmark (read-only).
 *   npx tsx scripts/grandma-search-perf.ts
 *
 * Loads UTF-16 or UTF-8 .env.local. Does not print secrets.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { performance } from "node:perf_hooks"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function stripQuotes(raw: string): string {
  const v = raw.trim()
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1)
  }
  return v
}

function readEnvText(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le")
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8")
  }
  const utf8 = buf.toString("utf8")
  if (utf8.includes("\u0000")) return buf.toString("utf16le").replace(/^\uFEFF/, "")
  return utf8
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = readEnvText(filePath)
  for (const line of text.split(/\r\n|\n|\r/)) {
    let t = line.trim()
    if (!t || t.startsWith("#")) continue
    if (t.startsWith("export ")) t = t.slice("export ".length).trim()
    const eq = t.indexOf("=")
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key]?.trim()) continue
    process.env[key] = stripQuotes(t.slice(eq + 1))
  }
}

loadEnvFile(path.join(root, ".env.local"))
loadEnvFile(path.join(root, ".env"))

type Row = {
  name: string
  ms: number
  ok: boolean
  shops: number
  suggestions: number
  queries: number
  slowestMs: number
  slowestLabel: string
  candidates: number
  detail: string
}

async function main() {
  const { getOnboardingMysqlConfig } = await import("../lib/onboarding-mysql")
  const { runGrandmaSearch, getGrandmaSearchSqlStats } = await import("../lib/grandma-search-mysql")
  const mysql = (await import("mysql2/promise")).default

  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    console.log("SKIP: MySQL env not loaded")
    process.exit(2)
  }

  const conn = await mysql.createConnection({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ...(cfg.port ? { port: cfg.port } : {}),
    connectTimeout: 8000,
  })
  const [gpsRows] = await conn.query(
    `SELECT supplier_latitude AS lat, supplier_longitude AS lng
     FROM account_signup
     WHERE TYPE='SELLER' AND STATUS='LIVE'
       AND supplier_latitude IS NOT NULL AND supplier_longitude IS NOT NULL
     LIMIT 1`,
  )
  await conn.end()
  const gps = (gpsRows as Array<{ lat?: number; lng?: number }>)[0]
  const origin = gps
    ? { lat: Number(gps.lat), lng: Number(gps.lng) }
    : { lat: -1.9536, lng: 30.0906 }

  const rows: Row[] = []

  async function bench(
    name: string,
    params: Parameters<typeof runGrandmaSearch>[0],
    check?: (r: Awaited<ReturnType<typeof runGrandmaSearch>>) => string,
  ) {
    const t0 = performance.now()
    const r = await runGrandmaSearch(params)
    const ms = performance.now() - t0
    const stats = getGrandmaSearchSqlStats()
    if (!r.ok) {
      rows.push({
        name,
        ms,
        ok: false,
        shops: 0,
        suggestions: 0,
        queries: stats.queries,
        slowestMs: stats.slowestMs,
        slowestLabel: stats.slowestLabel,
        candidates: stats.candidates,
        detail: `${r.code}`,
      })
      console.log(`FAIL ${ms.toFixed(0)}ms  ${name}  ${r.code}`)
      return
    }
    let detail = `shops=${r.shops.length} sug=${r.suggestions.length} src=${r.source} nearMe=${r.nearMe}`
    let ok = true
    try {
      if (check) detail = check(r)
    } catch (e) {
      ok = false
      detail = e instanceof Error ? e.message : String(e)
    }
    rows.push({
      name,
      ms,
      ok,
      shops: r.shops.length,
      suggestions: r.suggestions.length,
      queries: stats.queries,
      slowestMs: stats.slowestMs,
      slowestLabel: stats.slowestLabel,
      candidates: stats.candidates,
      detail,
    })
    const flag = !ok ? "FAIL" : ms > 3000 ? "SLOW" : "PASS"
    console.log(
      `${flag} ${ms.toFixed(0)}ms  q=${stats.queries} slow=${stats.slowestMs}ms:${stats.slowestLabel || "-"} cand=${stats.candidates}  ${name}  ${detail}`,
    )
  }

  console.log("=== Grandma Search performance ===")
  console.log(`origin=${origin.lat},${origin.lng}`)
  await runGrandmaSearch({ q: "milk", pageSize: 5 })
  console.log("warmup done\n")

  console.log("-- Autocomplete (suggestOnly) --")
  for (const q of ["c", "ch", "cha", "chap", "iphone", "milk"]) {
    await bench(`ac:${q}`, { q, suggest: true, suggestOnly: true, pageSize: 8 }, (r) => {
      if (!r.ok) throw new Error("not ok")
      if (r.shops.length) throw new Error(`expected 0 shops, got ${r.shops.length}`)
      if (r.suggestions.length > 10) throw new Error(`too many suggestions ${r.suggestions.length}`)
      return `sug=${r.suggestions.length} sample=${r.suggestions.slice(0, 3).join("|")}`
    })
  }

  console.log("\n-- Normal search --")
  for (const q of [
    "chapati",
    "chappati",
    "chappatti",
    "chapty",
    "chpati",
    "chapti",
    "cha pati",
    "pharmcie",
    "iphnoe",
    "shose",
    "milkk",
    "milk",
    "iphone",
  ]) {
    await bench(`search:${q}`, { q, suggest: true, pageSize: 20 }, (r) => {
      if (!r.ok) throw new Error("not ok")
      if (!r.shops.length) {
        if (q === "iphone" || q === "iphnoe" || q === "shose") {
          return "shops=0 (token not in this catalog)"
        }
        throw new Error("no shops")
      }
      return `shops=${r.shops.length} top=${r.shops[0].name} tier=${r.shops[0].matchTier} product=${r.shops[0].matchedProductSample || ""}`
    })
  }

  console.log("\n-- Negative --")
  for (const q of ["xyznonexistent", "completelyrandomword"]) {
    await bench(`neg:${q}`, { q, pageSize: 10 }, (r) => {
      if (!r.ok) throw new Error("not ok")
      return `shops=${r.shops.length} reason=${r.emptyReason}`
    })
  }

  console.log("\n-- Near Me --")
  await bench(
    "nearme:1km",
    { nearMe: true, lat: origin.lat, lng: origin.lng, radiusKm: 1, pageSize: 40 },
    (r) => {
      if (!r.ok) throw new Error("not ok")
      if (r.source !== "mysql") throw new Error(`source=${r.source}`)
      if (!r.nearMe) throw new Error("nearMe false")
      const over = r.shops.filter((s) => s.distanceKm != null && s.distanceKm > 1.05)
      if (over.length) throw new Error(`${over.length} beyond 1km`)
      const d0 = r.shops[0]?.distanceKm
      return `shops=${r.shops.length} nearest=${d0}km source=${r.source}`
    },
  )
  await bench(
    "nearme:5km",
    { nearMe: true, lat: origin.lat, lng: origin.lng, radiusKm: 5, pageSize: 40 },
    (r) => {
      if (!r.ok) throw new Error("not ok")
      const over = r.shops.filter((s) => s.distanceKm != null && s.distanceKm > 5.05)
      if (over.length) throw new Error(`${over.length} beyond 5km`)
      for (let i = 1; i < r.shops.length; i++) {
        const a = r.shops[i - 1]!.distanceKm
        const b = r.shops[i]!.distanceKm
        if (a != null && b != null && b + 0.05 < a) throw new Error("not nearest-first")
      }
      return `shops=${r.shops.length} nearest=${r.shops[0]?.distanceKm}km`
    },
  )
  await bench(
    "nearme:same-coord",
    { nearMe: true, lat: origin.lat, lng: origin.lng, radiusKm: 1, pageSize: 10 },
    (r) => {
      if (!r.ok) throw new Error("not ok")
      return `shops=${r.shops.length} d0=${r.shops[0]?.distanceKm}`
    },
  )
  await bench(
    "nearme:outside",
    { nearMe: true, lat: 0.1, lng: 0.1, radiusKm: 1, pageSize: 10 },
    (r) => {
      if (!r.ok) throw new Error("not ok")
      return `shops=${r.shops.length} reason=${r.emptyReason}`
    },
  )
  await bench(
    "search+nearme:chapati",
    {
      q: "chapati",
      suggest: true,
      nearMe: true,
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: 5,
      pageSize: 20,
    },
    (r) => {
      if (!r.ok) throw new Error("not ok")
      if (r.source !== "mysql") throw new Error(`source=${r.source}`)
      if (!r.nearMe) throw new Error("nearMe false")
      return `shops=${r.shops.length} nearest=${r.shops[0]?.distanceKm ?? "n/a"}km product=${r.shops[0]?.matchedProductSample || ""} reason=${r.emptyReason}`
    },
  )

  console.log("\n=== TABLE ===")
  console.log(
    "case".padEnd(32) +
      "ms".padStart(8) +
      "sql".padStart(6) +
      "slowMs".padStart(8) +
      " cand".padStart(6) +
      "  slowest / detail",
  )
  for (const r of rows) {
    console.log(
      `${(r.ok ? "" : "FAIL ") + r.name}`.padEnd(32) +
        r.ms.toFixed(0).padStart(8) +
        String(r.queries).padStart(6) +
        r.slowestMs.toFixed(0).padStart(8) +
        String(r.candidates).padStart(6) +
        `  ${r.slowestLabel} | ${r.detail}`,
    )
  }

  const slow = rows.filter((r) => r.ms > 3000 || !r.ok)
  if (slow.length) {
    console.log("\nOVER BUDGET OR FAIL:")
    for (const s of slow) console.log(`  ${s.name} ${s.ms.toFixed(0)}ms ${s.detail}`)
    process.exit(1)
  }
  console.log("\nAll measured cases ≤ 3000ms")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
