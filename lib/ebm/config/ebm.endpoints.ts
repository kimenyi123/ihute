/**
 * VSDC endpoint paths — loaded from environment or MySQL ebm_platform_config.
 * No hardcoded production URLs or paths in application code.
 */

export type EbmEndpoints = {
  invoice: string
  register: string
  registerCheck?: string
  itemSync?: string
}

const PATH_KEYS = {
  invoice: ["EBM_INVOICE_PATH"],
  register: ["EBM_REGISTER_PATH"],
  registerCheck: ["EBM_REGISTER_CHECK_PATH"],
  itemSync: ["EBM_ITEM_SYNC_PATH"],
} as const

function readEnvPath(keys: readonly string[]): string {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return normalizePath(v)
  }
  return ""
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ""
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

export function getEbmEndpointsFromEnv(): EbmEndpoints | null {
  const invoice = readEnvPath(PATH_KEYS.invoice)
  const register = readEnvPath(PATH_KEYS.register)
  if (!invoice || !register) return null

  const registerCheck = readEnvPath(PATH_KEYS.registerCheck) || undefined
  const itemSync = readEnvPath(PATH_KEYS.itemSync) || undefined

  return { invoice, register, registerCheck, itemSync }
}

export function getEbmEndpointsFromMap(map: Map<string, string>): Partial<EbmEndpoints> {
  const get = (key: string) => {
    const v = map.get(key)?.trim()
    return v ? normalizePath(v) : undefined
  }
  return {
    invoice: get("invoice_path"),
    register: get("register_path"),
    registerCheck: get("register_check_path"),
    itemSync: get("item_sync_path"),
  }
}

export function normalizeEndpointPath(path: string): string {
  return normalizePath(path)
}
