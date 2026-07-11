/**
 * Shared MySQL config for onboarding, EBM, admin_grandma, notifications, etc.
 *
 * Resolution order (first complete set wins):
 * 1. ONBOARDING_MYSQL_*
 * 2. EBM_MYSQL_*
 * 3. FORGOT_PASSWORD_MYSQL_*
 * 4. SUPPLIER_STOCK_MYSQL_*
 */
import type { Connection, ConnectionOptions } from "mysql2/promise"
import mysql from "mysql2/promise"

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

export function getOnboardingMysqlConfig(): OnboardingMysqlConfig | null {
  const prefixes = [
    "ONBOARDING_MYSQL",
    "EBM_MYSQL",
    "FORGOT_PASSWORD_MYSQL",
    "SUPPLIER_STOCK_MYSQL",
  ] as const

  for (const prefix of prefixes) {
    const host = process.env[`${prefix}_HOST`]?.trim()
    const user = process.env[`${prefix}_USER`]?.trim()
    const database = process.env[`${prefix}_DATABASE`]?.trim()
    if (!host || !user || !database) continue
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

  const genericHost = process.env.MYSQL_HOST?.trim()
  const genericUser = process.env.MYSQL_USER?.trim()
  const genericDatabase = process.env.MYSQL_DATABASE?.trim()
  if (genericHost && genericUser && genericDatabase) {
    const portRaw = process.env.MYSQL_PORT?.trim()
    const port = portRaw ? Number(portRaw) : undefined
    return {
      host: genericHost,
      user: genericUser,
      password: process.env.MYSQL_PASSWORD ?? "",
      database: genericDatabase,
      ...(Number.isFinite(port) && port! > 0 ? { port: port! } : {}),
    }
  }

  return null
}

/** Human-readable hint when MySQL is missing (for API error messages). */
export function onboardingMysqlConfigHint(): string {
  return (
    "Set ONBOARDING_MYSQL_HOST, ONBOARDING_MYSQL_USER, ONBOARDING_MYSQL_PASSWORD, " +
    "ONBOARDING_MYSQL_DATABASE in .env.local (same DB as Java backend). " +
    "If the password contains # wrap it in double quotes. " +
    "On production server use ONBOARDING_MYSQL_HOST=127.0.0.1 if MySQL runs on the same VM. " +
    "Public IP (64.225.66.239) may ETIMEDOUT from shop.ihute.rw if firewall blocks port 3306."
  )
}
