/**
 * Apply ORDER_SOURCE on the configured order schema (same DB as /api/admin/grandma/orders).
 *
 *   npx tsx scripts/add-order-transaction-order-source.ts
 *
 * Never prints host, user, password, or schema names.
 */
import fs from "node:fs"
import path from "node:path"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig, toMysqlConnectionOptions } from "../lib/onboarding-mysql"

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

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r\n|\n|\r/)) {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim()
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key]?.trim()) continue
    process.env[key] = stripQuotes(trimmed.slice(eq + 1))
  }
}

async function columnExists(conn: mysql.Connection, column: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_transaction' AND COLUMN_NAME = ?
     LIMIT 1`,
    [column],
  )
  return Array.isArray(rows) && rows.length > 0
}

async function indexExists(conn: mysql.Connection, indexName: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_transaction' AND INDEX_NAME = ?
     LIMIT 1`,
    [indexName],
  )
  return Array.isArray(rows) && rows.length > 0
}

async function main() {
  const cwd = process.cwd()
  loadEnvFile(path.join(cwd, ".env"))
  loadEnvFile(path.join(cwd, ".env.local"))

  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    console.log(JSON.stringify({ ok: false, error: "MySQL env not configured" }))
    process.exit(1)
  }

  const opts = toMysqlConnectionOptions(cfg)
  const conn = await mysql.createConnection({
    ...opts,
    connectTimeout: 20_000,
    enableKeepAlive: true,
  })

  try {
    await conn.query("SET SESSION wait_timeout = 600")
    await conn.query("SET SESSION interactive_timeout = 600")

    const tableOk = await conn
      .query(
        `SELECT 1 AS ok
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_transaction' AND TABLE_TYPE = 'BASE TABLE'
         LIMIT 1`,
      )
      .then(([rows]) => Array.isArray(rows) && rows.length > 0)

    if (!tableOk) {
      console.log(JSON.stringify({ ok: false, error: "order_transaction not in configured schema" }))
      process.exit(1)
    }

    let column = "exists"
    if (!(await columnExists(conn, "ORDER_SOURCE"))) {
      try {
        await conn.query(
          `ALTER TABLE order_transaction
           ADD COLUMN ORDER_SOURCE VARCHAR(32) NULL,
           ALGORITHM=INSTANT`,
        )
        column = "added-instant"
      } catch {
        await conn.query(
          `ALTER TABLE order_transaction
           ADD COLUMN ORDER_SOURCE VARCHAR(32) NULL`,
        )
        column = "added"
      }
    }

    let index = "skipped"
    if (await indexExists(conn, "idx_order_source_paid")) {
      index = "exists"
    } else if (
      (await columnExists(conn, "PAID_AT")) &&
      (await columnExists(conn, "PAYMENT_STATUS"))
    ) {
      try {
        await conn.query(
          `ALTER TABLE order_transaction
           ADD INDEX idx_order_source_paid (ORDER_SOURCE, PAYMENT_STATUS, PAID_AT)`,
        )
        index = "added"
      } catch (e) {
        index = e instanceof Error ? `failed:${e.message}` : "failed"
      }
    }

    console.log(JSON.stringify({ ok: true, column, index }))
  } finally {
    await conn.end()
  }
}

void main()
