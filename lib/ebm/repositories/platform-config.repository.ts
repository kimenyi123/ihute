import { createOnboardingMysqlConnection } from "@/lib/onboarding-mysql"
import {
  getEbmConfigFromMysqlMap,
  type EbmConfig,
} from "../config"

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS ebm_platform_config (
  config_key VARCHAR(64) NOT NULL PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/** Keys stored in ebm_platform_config — no unused columns. */
const CONFIG_KEYS = [
  "security_key",
  "company_tin",
  "base_url",
  "invoice_path",
  "register_path",
  "register_check_path",
  "item_sync_path",
] as const

let tableReady = false
let cache: { cfg: EbmConfig | null; at: number } | null = null
const CACHE_MS = 60_000

async function ensureTable(): Promise<void> {
  if (tableReady) return
  const conn = await createOnboardingMysqlConnection()
  try {
    await conn.query(ENSURE_TABLE)
    tableReady = true
  } finally {
    await conn.end()
  }
}

async function readConfigMap(): Promise<Map<string, string>> {
  await ensureTable()
  const conn = await createOnboardingMysqlConnection()
  try {
    const placeholders = CONFIG_KEYS.map(() => "?").join(", ")
    const [rows] = await conn.query(
      `SELECT config_key, config_value FROM ebm_platform_config
       WHERE config_key IN (${placeholders})`,
      [...CONFIG_KEYS],
    )
    const map = new Map<string, string>()
    for (const row of Array.isArray(rows) ? rows : []) {
      const r = row as { config_key?: string; config_value?: string }
      const k = String(r.config_key ?? "").trim().toLowerCase()
      const v = String(r.config_value ?? "").trim()
      if (k && v) map.set(k, v)
    }
    return map
  } finally {
    await conn.end()
  }
}

/** Load EBM credentials from MySQL when env vars are incomplete. */
export async function loadEbmConfigFromMysql(): Promise<EbmConfig | null> {
  try {
    const map = await readConfigMap()
    return getEbmConfigFromMysqlMap(map)
  } catch (e) {
    console.warn("[ebm-platform-config] MySQL load failed:", e)
    return null
  }
}

export async function loadEbmConfigResolved(): Promise<EbmConfig | null> {
  const { getEbmConfigFromEnv } = await import("../config")
  const fromEnv = getEbmConfigFromEnv()
  if (fromEnv) return fromEnv

  if (cache && Date.now() - cache.at < CACHE_MS) return cache.cfg

  const fromDb = await loadEbmConfigFromMysql()
  cache = { cfg: fromDb, at: Date.now() }
  return fromDb
}

export async function isEbmConfiguredResolved(): Promise<boolean> {
  const cfg = await loadEbmConfigResolved()
  return cfg != null
}

export function clearEbmConfigCache(): void {
  cache = null
}
