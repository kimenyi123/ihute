/**
 * Legacy MySQL e2e for the unused Next.js adapter (`lib/grandma-search-mysql.ts`).
 * Production Grandma Search is Java: GET /api/grandma/search → /grandma/search.
 * Do not treat this script as the production Search path.
 *
 *   npx tsx scripts/test-grandma-search-e2e.ts
 */
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const connectOnly = process.argv.includes("--connect-only")

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

/** Same resolution order as lib/onboarding-mysql getOnboardingMysqlConfig(). */
const PREFIXES = [
  "ONBOARDING_MYSQL",
  "EBM_MYSQL",
  "FORGOT_PASSWORD_MYSQL",
  "SUPPLIER_STOCK_MYSQL",
] as const

type Row = { name: string; pass: boolean; detail: string; ms: number | null }
const results: Row[] = []

function record(name: string, pass: boolean, detail = "", ms: number | null = null) {
  results.push({ name, pass, detail, ms })
  console.log(
    `${pass ? "PASS" : "FAIL"}${ms != null ? ` (${ms.toFixed(1)}ms)` : ""}: ${name}${detail ? " — " + detail : ""}`,
  )
}

async function timed(name: string, fn: () => Promise<string>) {
  const t0 = performance.now()
  try {
    const detail = await fn()
    const ms = performance.now() - t0
    record(name, true, detail, ms)
    return { ok: true as const, ms }
  } catch (e) {
    const ms = performance.now() - t0
    record(name, false, e instanceof Error ? e.message : String(e), ms)
    return { ok: false as const, ms }
  }
}

function statusOf(key: string): "SET" | "EMPTY" | "MISSING" {
  const v = process.env[key]
  if (v === undefined) return "MISSING"
  if (!v.trim() && !key.endsWith("_PASSWORD")) return "EMPTY"
  if (key.endsWith("_PASSWORD")) return v.length > 0 ? "SET" : "EMPTY"
  return "SET"
}

function printEnvAudit() {
  console.log("=== 1. Env names used by Grandma search API ===")
  console.log("API: GET /api/grandma/search → lib/grandma-search-mysql.ts → getOnboardingMysqlConfig()")
  console.log("Resolution order (first complete HOST+USER+DATABASE wins):")
  for (const p of PREFIXES) console.log(`  ${p}_HOST / _USER / _PASSWORD / _DATABASE [/ _PORT]`)
  console.log("  MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE [/ MYSQL_PORT]")
  console.log("")

  console.log("=== 2–3. Loaded from .env.local / process (no secret values) ===")
  const missingRequired: string[] = []
  let winningPrefix: string | null = null
  for (const p of PREFIXES) {
    const host = statusOf(`${p}_HOST`)
    const user = statusOf(`${p}_USER`)
    const pass = statusOf(`${p}_PASSWORD`)
    const db = statusOf(`${p}_DATABASE`)
    const port = statusOf(`${p}_PORT`)
    console.log(
      `  ${p}: HOST=${host} USER=${user} PASSWORD=${pass} DATABASE=${db} PORT=${port}`,
    )
    if (!winningPrefix && host === "SET" && user === "SET" && db === "SET") {
      winningPrefix = p
    }
  }
  const gHost = statusOf("MYSQL_HOST")
  const gUser = statusOf("MYSQL_USER")
  const gPass = statusOf("MYSQL_PASSWORD")
  const gDb = statusOf("MYSQL_DATABASE")
  const gPort = statusOf("MYSQL_PORT")
  console.log(
    `  MYSQL: HOST=${gHost} USER=${gUser} PASSWORD=${gPass} DATABASE=${gDb} PORT=${gPort}`,
  )
  if (!winningPrefix && gHost === "SET" && gUser === "SET" && gDb === "SET") {
    winningPrefix = "MYSQL"
  }

  if (!winningPrefix) {
    for (const p of ["ONBOARDING_MYSQL"] as const) {
      for (const s of ["HOST", "USER", "DATABASE"] as const) {
        const k = `${p}_${s}`
        if (statusOf(k) !== "SET") missingRequired.push(k)
      }
    }
    console.log("")
    console.log("MISSING (required for preferred prefix ONBOARDING_MYSQL):")
    for (const k of missingRequired) console.log(`  - ${k}`)
    console.log("Also checked: no complete EBM_/FORGOT_PASSWORD_/SUPPLIER_STOCK_/MYSQL_ set.")
    console.log("Note: .env.local has commented ONBOARDING_MYSQL_* / FORGOT_PASSWORD_MYSQL_* placeholders only.")
  } else {
    console.log("")
    console.log(`Winning config prefix: ${winningPrefix}`)
    const passKey = winningPrefix === "MYSQL" ? "MYSQL_PASSWORD" : `${winningPrefix}_PASSWORD`
    if (statusOf(passKey) === "EMPTY") {
      console.log(`  warning: ${passKey} is empty (allowed only if MySQL user has no password)`)
    }
  }
  console.log("")
  return winningPrefix
}

function classifyMysqlError(e: unknown): string {
  const err = e as { code?: string; errno?: number; sqlMessage?: string; message?: string }
  const code = String(err?.code ?? "")
  const msg = String(err?.message ?? err?.sqlMessage ?? e)
  if (code === "ER_ACCESS_DENIED_ERROR" || /access denied/i.test(msg)) {
    return `authentication error (${code || "ACCESS_DENIED"}): wrong user/password`
  }
  if (code === "ER_BAD_DB_ERROR" || /unknown database/i.test(msg)) {
    return `database not found (${code || "BAD_DB"})`
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `network error: host DNS not found (${code})`
  }
  if (code === "ECONNREFUSED") {
    return `network error: connection refused (MySQL not listening or wrong host/port)`
  }
  if (code === "ETIMEDOUT" || code === "EHOSTUNREACH" || /connect etimedout/i.test(msg)) {
    return `network error: timeout/unreachable (${code || "ETIMEDOUT"}) — firewall or wrong host`
  }
  if (code === "ER_NOT_SUPPORTED_AUTH_MODE") {
    return `authentication error: unsupported auth plugin (${code})`
  }
  return `connection failed: ${code || "UNKNOWN"} ${msg}`
}

async function main() {
  const { getOnboardingMysqlConfig, onboardingMysqlConfigHint } = await import("../lib/onboarding-mysql")
  const { runGrandmaSearch } = await import("../lib/grandma-search-mysql")
  const { haversineKm } = await import("../lib/geo-haversine")
  const mysql = (await import("mysql2/promise")).default

  console.log("=== Grandma search MySQL preflight / E2E ===\n")

  const winningPrefix = printEnvAudit()
  const cfg = getOnboardingMysqlConfig()

  record(
    "Env config resolvable via getOnboardingMysqlConfig()",
    Boolean(cfg),
    cfg
      ? `prefix=${winningPrefix} host=${cfg.host} port=${cfg.port ?? 3306} db=${cfg.database} user=${cfg.user} passwordSet=${Boolean(cfg.password)}`
      : onboardingMysqlConfigHint(),
  )

  if (!cfg) {
    console.log("\n=== 4. Database connection ===")
    console.log("SKIPPED — missing env (cannot attempt TCP/MySQL auth)")
    console.log("\n=== SUMMARY ===")
    console.log("FAILURE REASON: missing env")
    console.log("Full E2E suite NOT run.")
    console.log("Uncomment/set ONBOARDING_MYSQL_HOST/USER/PASSWORD/DATABASE in .env.local, then re-run.")
    process.exit(2)
  }

  const connOpts = {
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ...(cfg.port ? { port: cfg.port } : {}),
    connectTimeout: 8000,
  }

  console.log("=== 4. Database connection only ===")
  {
    const t0 = performance.now()
    try {
      const conn = await mysql.createConnection(connOpts)
      try {
        const [rows] = await conn.query<any[]>(
          "SELECT DATABASE() AS db, COUNT(*) AS sellers FROM account_signup WHERE TYPE='SELLER' AND STATUS='LIVE'",
        )
        const detail = `db=${rows[0].db} live_sellers=${rows[0].sellers}`
        record("Connect to real database", true, detail, performance.now() - t0)
      } finally {
        await conn.end()
      }
    } catch (e) {
      const reason = classifyMysqlError(e)
      record("Connect to real database", false, reason, performance.now() - t0)
      console.log("\n=== SUMMARY ===")
      console.log(`FAILURE REASON: ${reason}`)
      console.log("Full E2E suite NOT run.")
      process.exit(2)
    }
  }

  if (connectOnly) {
    console.log("\n=== SUMMARY ===")
    console.log("Connection OK. --connect-only set; full E2E skipped.")
    process.exit(0)
  }

  console.log("\n=== 5. Connection OK — continuing full E2E suite ===\n")

  await timed("10e. Required search/GPS columns exist", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [signupCols] = await conn.query<any[]>("SHOW COLUMNS FROM account_signup")
    const [sellerCols] = await conn.query<any[]>("SHOW COLUMNS FROM account_seller")
    const [stockCols] = await conn.query<any[]>("SHOW COLUMNS FROM seller_add_stock")
    await conn.end()
    const signup = new Set(signupCols.map((c) => String(c.Field)))
    const seller = new Set(sellerCols.map((c) => String(c.Field)))
    const stock = new Set(stockCols.map((c) => String(c.Field)))
    const needSignup = [
      "TYPE",
      "STATUS",
      "ISHYIGA_ACCOUNT",
      "OWNER",
      "PREFEREDCATEGORIES",
      "DEPARTMENT",
      "supplier_latitude",
      "supplier_longitude",
      "supplier_geohash",
      "gps_accuracy",
    ]
    const needStock = ["ITEM_NAME", "STATUS", "QUANTITY", "SELLER_ISHYIGA_ACCOUNT"]
    const missingSignup = needSignup.filter((c) => !signup.has(c))
    const missingStock = needStock.filter((c) => !stock.has(c))
    const missingSellerGps = ["supplier_latitude", "supplier_longitude"].filter((c) => !seller.has(c))
    if (missingSignup.length || missingStock.length || missingSellerGps.length) {
      throw new Error(
        `missing signup=${missingSignup.join(",")} stock=${missingStock.join(",")} sellerGps=${missingSellerGps.join(",")}`,
      )
    }
    return `signup=${signup.size} seller=${seller.size} stock=${stock.size}`
  })

  await timed("10a. Check geo indexes on account_signup", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [idx] = await conn.query<any[]>("SHOW INDEX FROM account_signup")
    await conn.end()
    const names = [...new Set(idx.map((r) => String(r.Key_name)))]
    const hasGps = names.some((n) =>
      ["idx_supplier_gps", "idx_supplier_location", "idx_seller_geo"].includes(n),
    )
    if (!hasGps) throw new Error(`Missing geo index. Found: ${names.slice(0, 25).join(",")}`)
    return `indexes=${names.filter((n) => /gps|geo|lat|location/i.test(n)).join("|")}`
  })

  await timed("10b. seller_add_stock retrieval indexes (FULLTEXT unused for prefixes)", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [idx] = await conn.query<any[]>("SHOW INDEX FROM seller_add_stock")
    await conn.end()
    const fulltext = [...new Set(idx.filter((r) => String(r.Index_type) === "FULLTEXT").map((r) => String(r.Key_name)))]
    const itemName = idx.filter((r) => String(r.Column_name) === "ITEM_NAME").map((r) => `${r.Key_name}:${r.Index_type}`)
    return `fulltext=${fulltext.join(",") || "none"} itemName=${itemName.slice(0, 6).join(",") || "none"}`
  })

  await timed("10c. Sellers with GPS coordinates", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [rows] = await conn.query<any[]>(`
    SELECT COUNT(*) AS with_gps FROM account_signup
    WHERE TYPE='SELLER' AND STATUS='LIVE'
      AND supplier_latitude IS NOT NULL AND supplier_longitude IS NOT NULL`)
    await conn.end()
    const n = Number(rows[0].with_gps)
    if (n < 1) throw new Error("No LIVE sellers with GPS — Near Me cannot be validated")
    return `with_gps=${n}`
  })

  // Read-only diagnostic: registration succeeded but GPS never landed on account_signup.
  // Does NOT modify rows. High counts usually mean ONBOARDING_MYSQL_* was missing at signup
  // and/or CreateSellerServlet ignored latitude/longitude.
  await timed("10d. LIVE sellers missing GPS (diagnostic)", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [rows] = await conn.query<any[]>(`
    SELECT COUNT(*) AS missing_gps FROM account_signup
    WHERE TYPE='SELLER' AND STATUS='LIVE'
      AND (supplier_latitude IS NULL OR supplier_longitude IS NULL)`)
    const [samples] = await conn.query<any[]>(`
    SELECT ISHYIGA_ACCOUNT AS acct, OWNER AS name
    FROM account_signup
    WHERE TYPE='SELLER' AND STATUS='LIVE'
      AND (supplier_latitude IS NULL OR supplier_longitude IS NULL)
    ORDER BY ID DESC
    LIMIT 5`)
    await conn.end()
    const n = Number(rows[0].missing_gps)
    const sample = samples
      .map((r) => `${String(r.acct || "").trim()}:${String(r.name || "").trim().slice(0, 24)}`)
      .filter(Boolean)
      .join(" | ")
    return `missing_gps=${n}${sample ? ` samples=${sample}` : ""} (read-only; not fixed)`
  })

  let productToken = "milk"
  await timed("3a. Discover real product token", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [rows] = await conn.query<any[]>(`
    SELECT ITEM_NAME AS name FROM seller_add_stock
    WHERE STATUS='ACTIVE' AND QUANTITY>0 AND ITEM_NAME IS NOT NULL AND CHAR_LENGTH(ITEM_NAME)>=4
    ORDER BY ID DESC LIMIT 50`)
    await conn.end()
    if (!rows.length) throw new Error("No ACTIVE stock item names")
    for (const r of rows) {
      const words = String(r.name)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w: string) => w.length >= 4)
      if (words[0]) {
        productToken = words[0]
        break
      }
    }
    return `token=${productToken} sample=${String(rows[0].name).slice(0, 50)}`
  })

  await timed("3. Keyword search with real products", async () => {
    const r = await runGrandmaSearch({ q: productToken, page: 1, pageSize: 10 })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    if (!r.shops.length) throw new Error(`No shops for q=${productToken}`)
    return `shops=${r.shops.length} total=${r.total} top=${r.shops[0].name} score=${r.shops[0].score}`
  })

  await timed("3b. Keyword milk returns shops that sell milk", async () => {
    const r = await runGrandmaSearch({ q: "milk", page: 1, pageSize: 20 })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    if (!r.shops.length) throw new Error("No shops for q=milk")
    const sample = r.shops.find((s) => /milk/i.test(s.matchedProductSample || s.name || ""))
    if (!sample) {
      throw new Error(
        `milk shops=${r.shops.length} but none had milk in name/product (top=${r.shops[0].name} product=${r.shops[0].matchedProductSample})`,
      )
    }
    return `shops=${r.shops.length} top=${sample.name} product=${sample.matchedProductSample || ""}`
  })

  await timed("3c. Sector pharmacy search", async () => {
    const r = await runGrandmaSearch({ sector: "pharmacy", pageSize: 10 })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    return `shops=${r.shops.length} total=${r.total} cats=${[...new Set(r.shops.map((s) => s.category))].join(",")}`
  })

  await timed("4. Autocomplete suggestions", async () => {
    const prefix = productToken.slice(0, Math.min(3, productToken.length))
    const r = await runGrandmaSearch({ q: prefix, suggest: true, pageSize: 5 })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    if (!r.suggestions.length) throw new Error(`No suggestions for ${prefix}`)
    return `prefix=${prefix} → ${r.suggestions.slice(0, 5).join(" | ")}`
  })

  await timed("5. Fuzzy search (typo)", async () => {
    const typo =
      productToken.length >= 4
        ? productToken.slice(0, -1) + productToken.slice(-1) + productToken.slice(-1)
        : productToken + "x"
    const r = await runGrandmaSearch({ q: typo, pageSize: 10 })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    if (!r.shops.length) throw new Error(`No shops for typo ${typo} (fuzzy SQL stem should retrieve ${productToken})`)
    return `typo=${typo} shops=${r.shops.length} tiers=${[...new Set(r.shops.map((s) => s.matchTier))].join(",")}`
  })

  let origin = { lat: -1.9536, lng: 30.0906 }
  await timed("6a. Load real seller GPS origin", async () => {
    const conn = await mysql.createConnection(connOpts)
    const [rows] = await conn.query<any[]>(`
    SELECT supplier_latitude AS lat, supplier_longitude AS lng, OWNER AS name
    FROM account_signup
    WHERE TYPE='SELLER' AND STATUS='LIVE'
      AND supplier_latitude IS NOT NULL AND supplier_longitude IS NOT NULL
    LIMIT 1`)
    await conn.end()
    if (!rows.length) throw new Error("No seller GPS")
    origin = { lat: Number(rows[0].lat), lng: Number(rows[0].lng) }
    return `origin=${origin.lat},${origin.lng} seller=${rows[0].name}`
  })

  await timed("6. Near Me with real seller coordinates", async () => {
    const r = await runGrandmaSearch({
      nearMe: true,
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: 5,
      pageSize: 20,
    })
    if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
    if (!r.shops.length) throw new Error("No shops within 5km of known seller GPS")
    return `shops=${r.shops.length} nearest=${r.shops[0].name} dist=${r.shops[0].distanceKm}km`
  })

  await timed("7. Radius filtering 5 vs 50 vs all", async () => {
    const a = await runGrandmaSearch({
      nearMe: true,
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: 5,
      pageSize: 50,
    })
    const b = await runGrandmaSearch({
      nearMe: true,
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: 50,
      pageSize: 50,
    })
    const c = await runGrandmaSearch({
      nearMe: true,
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: null,
      pageSize: 50,
    })
    if (!a.ok || !b.ok || !c.ok) throw new Error("radius query failed")
    if (a.total > b.total) throw new Error(`5km (${a.total}) > 50km (${b.total})`)
    const over = a.shops.filter((s) => s.distanceKm != null && s.distanceKm > 5.05)
    if (over.length) throw new Error(`${over.length} shops beyond 5km in results`)
    return `n5=${a.total} n50=${b.total} nAll=${c.total}`
  })

  await timed("8. Pagination page1 vs page2", async () => {
    const p1 = await runGrandmaSearch({ q: productToken, page: 1, pageSize: 3 })
    const p2 = await runGrandmaSearch({ q: productToken, page: 2, pageSize: 3 })
    if (!p1.ok || !p2.ok) throw new Error("pagination failed")
    if (!p1.shops.length) throw new Error("page1 empty")
    const ids1 = new Set(p1.shops.map((s) => s.sellerAccount))
    const overlap = p2.shops.filter((s) => ids1.has(s.sellerAccount)).length
    if (p1.hasMore && p2.shops.length && overlap === p2.shops.length && p1.total > 3) {
      throw new Error("page2 fully overlaps page1")
    }
    return `p1=${p1.shops.map((s) => s.sellerAccount).join(",")} p2=${p2.shops.map((s) => s.sellerAccount).join(",")} hasMore=${p1.hasMore}`
  })

  await timed("9. Ranking scores non-increasing", async () => {
    const r = await runGrandmaSearch({ q: productToken, pageSize: 15 })
    if (!r.ok) throw new Error(r.error)
    if (r.shops.length < 2) return `only ${r.shops.length} hit`
    for (let i = 1; i < r.shops.length; i++) {
      if (r.shops[i]!.score > r.shops[i - 1]!.score + 0.001) {
        throw new Error(`score rose at ${i}`)
      }
    }
    return r.shops
      .slice(0, 5)
      .map((s) => `${s.name}:${s.score}:${s.matchTier}`)
      .join(" | ")
  })

  const timedOnly = results.filter((r) => r.ms != null)
  const avg = timedOnly.reduce((a, r) => a + (r.ms || 0), 0) / (timedOnly.length || 1)
  const slow = [...timedOnly].sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 5)
  console.log("\n=== PERFORMANCE ===")
  console.log(`Average step time: ${avg.toFixed(1)}ms (${timedOnly.length} steps)`)
  console.log("Slowest:")
  for (const s of slow) {
    console.log(`  ${s.ms!.toFixed(1)}ms  ${s.name}${s.ms! > 2000 ? "  ← BOTTLENECK >2s" : ""}`)
  }

  record(
    "11b. Haversine at origin ~0",
    Math.abs(haversineKm(origin.lat, origin.lng, origin.lat, origin.lng)) < 1e-6,
  )

  console.log("\n=== SUMMARY ===")
  const failed = results.filter((r) => !r.pass)
  console.log(`Passed ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    for (const f of failed) console.log(`FAIL: ${f.name} — ${f.detail}`)
    process.exit(1)
  }
  console.log("ALL INTEGRATION CHECKS PASSED")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
