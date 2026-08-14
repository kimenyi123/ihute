/**
 * EXPLAIN the Grandma product-search plans (read-only).
 *   npx tsx scripts/explain-grandma-search.ts
 * Does not print passwords. Does not run DDL/DML.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "../lib/onboarding-mysql"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(path.join(root, ".env.local"))
loadEnvFile(path.join(root, ".env"))

function cfg() {
  const c = getOnboardingMysqlConfig()
  if (!c) return null
  return {
    host: c.host,
    user: c.user,
    database: c.database,
    password: c.password,
    port: c.port,
  }
}

async function main() {
  const c = cfg()
  if (!c) {
    console.log("SKIP: MySQL env not loaded")
    process.exit(2)
  }
  console.log(`database=${c.database}`)
  const conn = await mysql.createConnection({
    host: c.host,
    user: c.user,
    password: c.password,
    database: c.database,
    port: c.port,
  })
  try {
    const [idx] = await conn.query(
      `SHOW INDEX FROM seller_add_stock WHERE Index_type = 'FULLTEXT' OR Key_name LIKE '%fulltext%' OR Column_name IN ('ITEM_NAME','DESCRIPTION_KEYWORD','SELLER_ISHYIGA_ACCOUNT','STATUS')`,
    )
    console.log("\n=== seller_add_stock relevant indexes ===")
    console.log(
      (idx as { Key_name: string; Column_name: string; Index_type: string }[])
        .map((r) => `${r.Key_name} ${r.Column_name} ${r.Index_type}`)
        .join("\n"),
    )

    const existsSql = `
      EXPLAIN SELECT a.ISHYIGA_ACCOUNT
      FROM account_signup a
      WHERE a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'
        AND EXISTS (
          SELECT 1 FROM seller_add_stock s
          WHERE s.SELLER_ISHYIGA_ACCOUNT = a.ISHYIGA_ACCOUNT
            AND s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
            AND LOWER(s.ITEM_NAME) LIKE '%milk%'
        )
      LIMIT 250
    `
    const ftJoinSql = `
      EXPLAIN SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT
      FROM seller_add_stock s
      INNER JOIN account_signup a
        ON a.ISHYIGA_ACCOUNT = s.SELLER_ISHYIGA_ACCOUNT
       AND a.TYPE = 'SELLER' AND a.STATUS = 'LIVE'
      WHERE s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
        AND MATCH(s.ITEM_NAME, s.DESCRIPTION_KEYWORD) AGAINST ('+milk*' IN BOOLEAN MODE)
      LIMIT 250
    `
    const ftNoJoinSql = `
      EXPLAIN SELECT DISTINCT s.SELLER_ISHYIGA_ACCOUNT
      FROM seller_add_stock s
      WHERE s.STATUS = 'ACTIVE' AND s.QUANTITY > 0
        AND MATCH(s.ITEM_NAME, s.DESCRIPTION_KEYWORD) AGAINST ('+milk*' IN BOOLEAN MODE)
      LIMIT 250
    `

    console.log("\n=== EXPLAIN EXISTS+LIKE (old) ===")
    const [ex1] = await conn.query(existsSql)
    console.log(JSON.stringify(ex1, null, 2))

    console.log("\n=== EXPLAIN FULLTEXT + JOIN (previous) ===")
    try {
      const [ex2] = await conn.query(ftJoinSql)
      console.log(JSON.stringify(ex2, null, 2))
    } catch (e) {
      console.log("FULLTEXT JOIN EXPLAIN failed:", e instanceof Error ? e.message : e)
    }

    console.log("\n=== EXPLAIN FULLTEXT no JOIN (current) ===")
    try {
      const [ex3] = await conn.query(ftNoJoinSql)
      console.log(JSON.stringify(ex3, null, 2))
    } catch (e) {
      console.log("FULLTEXT no-JOIN EXPLAIN failed:", e instanceof Error ? e.message : e)
    }

    try {
      console.log("\n=== EXPLAIN ANALYZE FULLTEXT no JOIN ===")
      const [exA] = await conn.query(ftNoJoinSql.replace(/^EXPLAIN\s+/i, "EXPLAIN ANALYZE "))
      console.log(JSON.stringify(exA, null, 2))
    } catch (e) {
      console.log("EXPLAIN ANALYZE unsupported or failed:", e instanceof Error ? e.message : e)
    }

    const t0 = Date.now()
    const [ftRows] = await conn.query(ftNoJoinSql.replace(/^EXPLAIN\s+/i, ""))
    console.log(`\nFULLTEXT no-JOIN milk sellers=${(ftRows as unknown[]).length} ms=${Date.now() - t0}`)

    const t1 = Date.now()
    const [ftJoinRows] = await conn.query(ftJoinSql.replace(/^EXPLAIN\s+/i, ""))
    console.log(`FULLTEXT JOIN milk sellers=${(ftJoinRows as unknown[]).length} ms=${Date.now() - t1}`)
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
