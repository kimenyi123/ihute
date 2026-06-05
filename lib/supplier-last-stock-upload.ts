import mysql from "mysql2/promise"

function mysqlConfig(): {
  host: string
  user: string
  password: string
  database: string
} | null {
  const host = process.env.SUPPLIER_STOCK_MYSQL_HOST || process.env.ONBOARDING_MYSQL_HOST
  const user = process.env.SUPPLIER_STOCK_MYSQL_USER || process.env.ONBOARDING_MYSQL_USER
  const password =
    process.env.SUPPLIER_STOCK_MYSQL_PASSWORD ?? process.env.ONBOARDING_MYSQL_PASSWORD
  const database =
    process.env.SUPPLIER_STOCK_MYSQL_DATABASE || process.env.ONBOARDING_MYSQL_DATABASE
  if (!host || !user || password === undefined || !database) return null
  return { host, user, password, database }
}

function formatSqlTimestamp(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  const s = String(value).trim()
  return s || null
}

/** Fallback when Java SupplierStock has not been redeployed with lastStockUploadAt yet. */
export async function readMaxSyncedTimeForSupplier(
  account: string,
): Promise<string | null> {
  const cfg = mysqlConfig()
  const acc = account.trim()
  if (!cfg || !acc) return null

  let conn: mysql.Connection | undefined
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    })
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT MAX(SYNCED_TIME) AS last_sync FROM seller_add_stock WHERE SELLER_ISHYIGA_ACCOUNT = ?",
      [acc],
    )
    return formatSqlTimestamp(rows[0]?.last_sync)
  } catch {
    return null
  } finally {
    await conn?.end().catch(() => {})
  }
}
