/**
 * MySQL settings aligned with kaos {@code Kaos.MySQLConnector}:
 * - Prefer explicit Next.js GQ_/ONBOARDING_/MYSQL_ vars
 * - Also accept Tomcat-style {@code DB_URL} + {@code DB_USER} + {@code DB_PASS}
 *   (same shape as kaos {@code EnvLoader} / {@code applyMainDbEnvOverrides})
 *
 * Next.js cannot read Ndumiwe.hisha; set the same host/user/db as Trading_*.war
 * in the frontend `.env` / `.env.local` on each deploy host.
 */
import type { PoolOptions } from "mysql2/promise"

export type KaosAlignedMysqlConfig = {
  host: string
  port?: number
  user: string
  password: string
  database: string
  /** Which env family won (for ops / error messages). */
  source: string
}

/** Parse jdbc:mysql://host:port/db?… or mysql://host/db — mirrors MySQLConnector.applyMainDbEnvOverrides. */
export function parseKaosJdbcMysqlUrl(
  raw: string,
): { host: string; port?: number; database: string } | null {
  let hostAndDb = raw.trim()
  if (!hostAndDb) return null
  if (hostAndDb.startsWith("jdbc:mysql://")) {
    hostAndDb = hostAndDb.slice("jdbc:mysql://".length)
  } else if (hostAndDb.startsWith("mysql://")) {
    hostAndDb = hostAndDb.slice("mysql://".length)
  }

  const slash = hostAndDb.indexOf("/")
  if (slash <= 0 || slash === hostAndDb.length - 1) return null

  let hostPart = hostAndDb.slice(0, slash)
  let dbPart = hostAndDb.slice(slash + 1)
  const query = dbPart.indexOf("?")
  if (query >= 0) dbPart = dbPart.slice(0, query)
  dbPart = dbPart.trim()
  if (!dbPart || !/^[a-zA-Z0-9_]+$/.test(dbPart)) return null

  let port: number | undefined
  const colon = hostPart.indexOf(":")
  if (colon >= 0) {
    const portRaw = hostPart.slice(colon + 1).trim()
    hostPart = hostPart.slice(0, colon).trim()
    const n = Number(portRaw)
    if (Number.isFinite(n) && n > 0) port = n
  } else {
    hostPart = hostPart.trim()
  }
  if (!hostPart) return null
  return { host: hostPart, database: dbPart, ...(port ? { port } : {}) }
}

function fromPrefix(prefix: string): KaosAlignedMysqlConfig | null {
  const host = process.env[`${prefix}_HOST`]?.trim()
  const user = process.env[`${prefix}_USER`]?.trim()
  const database = process.env[`${prefix}_DATABASE`]?.trim()
  if (!host || !user || !database) return null
  const password = process.env[`${prefix}_PASSWORD`] ?? ""
  const portRaw = process.env[`${prefix}_PORT`]?.trim()
  const port = portRaw ? Number(portRaw) : undefined
  return {
    host,
    user,
    password,
    database,
    source: prefix,
    ...(Number.isFinite(port) && port! > 0 ? { port: port! } : {}),
  }
}

/** Same resolution order as marketplace / prescription needs + kaos DB_* mirror. */
export function getKaosAlignedMysqlConfig(): KaosAlignedMysqlConfig | null {
  const gq = fromPrefix("GQ_MYSQL")
  if (gq) return gq

  const onboarding = fromPrefix("ONBOARDING_MYSQL")
  if (onboarding) return onboarding

  const ebm = fromPrefix("EBM_MYSQL")
  if (ebm) return ebm

  const generic = fromPrefix("MYSQL")
  if (generic) return generic

  // Kaos MySQLConnector / EnvLoader
  const envUrl = process.env.DB_URL?.trim()
  const envUser = process.env.DB_USER?.trim()
  const envPass = process.env.DB_PASS
  if (envUrl && envUser && envPass !== undefined) {
    const parsed = parseKaosJdbcMysqlUrl(envUrl)
    if (parsed) {
      return {
        host: parsed.host,
        port: parsed.port,
        user: envUser,
        password: envPass,
        database: parsed.database,
        source: "DB_URL/DB_USER/DB_PASS (kaos MySQLConnector)",
      }
    }
  }

  return null
}

export function kaosAlignedMysqlConfigHint(): string {
  return (
    "MySQL is not configured for Next.js. Set the same marketplace DB as kaos MySQLConnector: " +
    "GQ_MYSQL_HOST/USER/PASSWORD/DATABASE (preferred), or ONBOARDING_MYSQL_*, or copy kaos Tomcat " +
    "DB_URL + DB_USER + DB_PASS into the frontend .env (jdbc:mysql://host:3306/chaos_dev). " +
    "Ensure that user can read niki.niki_items (NIKI_MYSQL_DATABASE defaults to niki)."
  )
}

export function toKaosAlignedPoolOptions(cfg: KaosAlignedMysqlConfig): PoolOptions {
  return {
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ...(cfg.port ? { port: cfg.port } : {}),
    connectionLimit: 4,
    connectTimeout: 15_000,
    enableKeepAlive: true,
  }
}
