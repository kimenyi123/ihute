/**
 * Shared MySQL config for onboarding, EBM, Grandma Search, notifications, etc.
 *
 * Resolution order (first complete set wins — HOST + USER + DATABASE required):
 * 1. ONBOARDING_MYSQL_*
 * 2. EBM_MYSQL_*
 * 3. FORGOT_PASSWORD_MYSQL_*
 * 4. SUPPLIER_STOCK_MYSQL_*
 * 5. GQ_MYSQL_*          (existing marketplace / order MySQL namespace)
 * 6. MYSQL_*
 * 7. DB_URL + DB_USER + DB_PASS  (kaos Tomcat EnvLoader / MySQLConnector shape)
 *
 * Schema name is never hardcoded; each deploy host sets it in that clone's .env.
 */
import type { Connection, ConnectionOptions } from "mysql2/promise"
import mysql from "mysql2/promise"
import { parseKaosJdbcMysqlUrl } from "@/lib/kaos-mysql-config"

export type OnboardingMysqlConfig = {
  host: string
  port?: number
  user: string
  password: string
  database: string
}

function connectTimeoutMs(): number {
  const raw =
    process.env.ONBOARDING_MYSQL_CONNECT_TIMEOUT_MS?.trim() ||
    process.env.EBM_MYSQL_CONNECT_TIMEOUT_MS?.trim() ||
    "5000"
  const n = Number(raw)
  return Number.isFinite(n) && n > 1000 ? n : 5000
}

/** Options passed to mysql2 createConnection (includes connectTimeout). */
export function toMysqlConnectionOptions(cfg: OnboardingMysqlConfig): ConnectionOptions {
  return {
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ...(cfg.port ? { port: cfg.port } : {}),
    connectTimeout: connectTimeoutMs(),
  }
}

export function isMysqlUnreachableError(e: unknown): boolean {
  const err = e as { code?: string; errno?: string; message?: string }
  const code = String(err?.code ?? "")
  const msg = String(err?.message ?? "").toLowerCase()
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    msg.includes("connect etimedout") ||
    msg.includes("connection lost")
  )
}

export async function createOnboardingMysqlConnection(): Promise<Connection> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) throw new Error(onboardingMysqlConfigHint())
  return mysql.createConnection(toMysqlConnectionOptions(cfg))
}

const MYSQL_ENV_PREFIXES = [
  "ONBOARDING_MYSQL",
  "EBM_MYSQL",
  "FORGOT_PASSWORD_MYSQL",
  "SUPPLIER_STOCK_MYSQL",
  "GQ_MYSQL",
] as const

export type OnboardingMysqlEnvSource =
  | (typeof MYSQL_ENV_PREFIXES)[number]
  | "MYSQL"
  | "DB_URL"

export type EnvFieldPresence = "present" | "missing"

type PrefixPresence = {
  host: EnvFieldPresence
  user: EnvFieldPresence
  database: EnvFieldPresence
  port: EnvFieldPresence | "default"
  password: EnvFieldPresence
}

/** Presence-only status. Never includes host/user/database/password values. */
export type OnboardingMysqlConfigStatus = {
  configured: boolean
  source: OnboardingMysqlEnvSource | null
  onboardingMysql: PrefixPresence
  gqMysql: PrefixPresence
  kaosJdbc: {
    url: EnvFieldPresence
    user: EnvFieldPresence
    password: EnvFieldPresence
  }
}

function envNonEmpty(raw: string | undefined): boolean {
  return Boolean(raw?.trim())
}

function configFromPrefix(prefix: string): OnboardingMysqlConfig | null {
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
    ...(Number.isFinite(port) && port! > 0 ? { port: port! } : {}),
  }
}

function prefixPresence(prefix: string): PrefixPresence {
  const passwordRaw = process.env[`${prefix}_PASSWORD`]
  return {
    host: envNonEmpty(process.env[`${prefix}_HOST`]) ? "present" : "missing",
    user: envNonEmpty(process.env[`${prefix}_USER`]) ? "present" : "missing",
    database: envNonEmpty(process.env[`${prefix}_DATABASE`]) ? "present" : "missing",
    port: envNonEmpty(process.env[`${prefix}_PORT`]) ? "present" : "default",
    password: passwordRaw === undefined ? "missing" : "present",
  }
}

function configFromKaosJdbc(): OnboardingMysqlConfig | null {
  const envUrl = process.env.DB_URL?.trim()
  const envUser = process.env.DB_USER?.trim()
  const envPass = process.env.DB_PASS
  if (!envUrl || !envUser || envPass === undefined) return null
  const parsed = parseKaosJdbcMysqlUrl(envUrl)
  if (!parsed) return null
  return {
    host: parsed.host,
    user: envUser,
    password: envPass,
    database: parsed.database,
    ...(parsed.port ? { port: parsed.port } : {}),
  }
}

export function getOnboardingMysqlConfig(): OnboardingMysqlConfig | null {
  for (const prefix of MYSQL_ENV_PREFIXES) {
    const cfg = configFromPrefix(prefix)
    if (cfg) return cfg
  }
  const generic = configFromPrefix("MYSQL")
  if (generic) return generic
  return configFromKaosJdbc()
}

function resolvedMysqlSource(): OnboardingMysqlEnvSource | null {
  for (const prefix of MYSQL_ENV_PREFIXES) {
    if (configFromPrefix(prefix)) return prefix
  }
  if (configFromPrefix("MYSQL")) return "MYSQL"
  if (configFromKaosJdbc()) return "DB_URL"
  return null
}

/**
 * Safe for logs and API error payloads. Does not return secrets or connection values.
 * `onboardingMysql.*` is the preferred prefix ops should set on each deploy host.
 */
export function getOnboardingMysqlConfigStatus(): OnboardingMysqlConfigStatus {
  const source = resolvedMysqlSource()
  return {
    configured: source != null,
    source,
    onboardingMysql: prefixPresence("ONBOARDING_MYSQL"),
    gqMysql: prefixPresence("GQ_MYSQL"),
    kaosJdbc: {
      url: envNonEmpty(process.env.DB_URL) ? "present" : "missing",
      user: envNonEmpty(process.env.DB_USER) ? "present" : "missing",
      password: process.env.DB_PASS === undefined ? "missing" : "present",
    },
  }
}

/** Human-readable hint when MySQL is missing (for API error messages). */
export function onboardingMysqlConfigHint(): string {
  return (
    "Set the same MySQL schema as the Java backend (GET {JAVA_BACKEND_BASE}/Kaos/deployment-hint → database) " +
    "in the Next.js server .env: ONBOARDING_MYSQL_HOST/USER/PASSWORD/DATABASE, or existing GQ_MYSQL_*, " +
    "or MYSQL_*, or Tomcat DB_URL+DB_USER+DB_PASS. HOST, USER, and DATABASE are required; PORT defaults to 3306. " +
    "If the password contains # wrap it in double quotes. " +
    "On the app VM use host 127.0.0.1 if MySQL is local. " +
    "Do not copy .env.example placeholders (your_mysql_user / your_kaos_database)."
  )
}
