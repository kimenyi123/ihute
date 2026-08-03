/**
 * Central EBM / VSDC configuration.
 * All production values come from environment variables or MySQL ebm_platform_config.
 */

import {
  getEbmEndpointsFromEnv,
  getEbmEndpointsFromMap,
  type EbmEndpoints,
} from "@/lib/ebm/config/ebm.endpoints"

export type EbmConfig = {
  baseUrl: string
  securityKey: string
  companyTin: string
  timeoutMs: number
  retryAttempts: number
  endpoints: EbmEndpoints
  /** POST via shop proxy when direct VSDC is unreachable. */
  proxyUrl?: string
}

export type EbmConfigSource = "env" | "mysql"

const SECURITY_KEY_ENV_KEYS = [
  "EBM_SECURITY_KEY",
  "RRA_EBM_SECURITY_KEY",
  "ISHYIGA_EBM_SECURITY_KEY",
  "VSDC_SECURITY_KEY",
] as const

const BASE_URL_ENV_KEYS = ["EBM_BASE_URL", "RRA_EBM_BASE_URL", "VSDC_BASE_URL"] as const

const COMPANY_TIN_ENV_KEYS = ["EBM_COMPANY_TIN", "RRA_COMPANY_TIN"] as const

function readFirstEnv(keys: readonly string[]): string {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return ""
}

function readSecurityKey(): string {
  return readFirstEnv(SECURITY_KEY_ENV_KEYS)
}

function readBaseUrl(): string {
  return readFirstEnv(BASE_URL_ENV_KEYS).replace(/\/$/, "")
}

function readCompanyTin(): string {
  return readFirstEnv(COMPANY_TIN_ENV_KEYS)
}

function readTimeoutMs(): number {
  return Math.max(5000, Number(process.env.EBM_TIMEOUT_MS) || 30000)
}

function readRetryAttempts(): number {
  return Math.max(0, Math.min(10, Number(process.env.EBM_RETRY_ATTEMPTS) || 3))
}

function readProxyUrl(): string | undefined {
  const v = process.env.EBM_PROXY_URL?.trim()
  return v || undefined
}

function buildConfig(partial: {
  securityKey: string
  baseUrl?: string
  companyTin?: string
  endpoints?: Partial<EbmEndpoints>
}): EbmConfig | null {
  const securityKey = partial.securityKey.trim()
  if (!securityKey) return null

  const baseUrl = (partial.baseUrl || readBaseUrl()).replace(/\/$/, "")
  if (!baseUrl) return null

  const envEndpoints = getEbmEndpointsFromEnv()
  const endpoints: EbmEndpoints = {
    invoice: partial.endpoints?.invoice || envEndpoints?.invoice || "",
    register: partial.endpoints?.register || envEndpoints?.register || "",
    registerCheck: partial.endpoints?.registerCheck ?? envEndpoints?.registerCheck,
    itemSync: partial.endpoints?.itemSync ?? envEndpoints?.itemSync,
  }

  if (!endpoints.invoice || !endpoints.register) return null

  return {
    baseUrl,
    securityKey,
    companyTin: partial.companyTin?.trim() || readCompanyTin(),
    timeoutMs: readTimeoutMs(),
    retryAttempts: readRetryAttempts(),
    endpoints,
    proxyUrl: readProxyUrl(),
  }
}

export function isEbmConfigured(): boolean {
  return getEbmConfigFromEnv() != null
}

/** Off by default — buyer-requested EBM requires seller approval on dashboard. */
export function isEbmAutoFiscalizeEnabled(): boolean {
  return process.env.EBM_AUTO_FISCALIZE === "true" || process.env.EBM_AUTO_FISCALIZE === "1"
}

/** Auto-register company on VSDC before invoice approval (default ON). */
export function isEbmAutoRegisterEnabled(): boolean {
  const v = process.env.EBM_AUTO_REGISTER?.trim().toLowerCase()
  if (v === "false" || v === "0" || v === "no") return false
  return true
}

export function getEbmConfigFromEnv(): EbmConfig | null {
  const securityKey = readSecurityKey()
  if (!securityKey) return null
  return buildConfig({ securityKey })
}

export function getEbmConfigFromMysqlMap(map: Map<string, string>): EbmConfig | null {
  const securityKey = map.get("security_key")?.trim()
  if (!securityKey) return null

  const dbEndpoints = getEbmEndpointsFromMap(map)
  return buildConfig({
    securityKey,
    baseUrl: map.get("base_url"),
    companyTin: map.get("company_tin"),
    endpoints: dbEndpoints,
  })
}

/** @deprecated use getEbmConfigFromEnv or loadEbmConfigResolved */
export function getEbmConfig(): EbmConfig | null {
  return getEbmConfigFromEnv()
}

export function getEbmSetupHint(): string {
  return (
    "Configure EBM: set EBM_SECURITY_KEY, EBM_BASE_URL, EBM_INVOICE_PATH, EBM_REGISTER_PATH " +
    "in ihute-frontend/.env.local and restart npm run dev, OR insert values into MySQL " +
    "table ebm_platform_config (see sql/ebm_platform_config.sql)."
  )
}

export function getEbmInvoiceUrl(cfg: EbmConfig): string {
  return `${cfg.baseUrl}${cfg.endpoints.invoice}`
}

export function getEbmPostUrl(cfg: EbmConfig): string {
  if (cfg.proxyUrl) return cfg.proxyUrl.replace(/\/$/, "")
  return getEbmInvoiceUrl(cfg)
}

export function getEbmRegisterPath(cfg: EbmConfig): string {
  return cfg.endpoints.register
}

export function getEbmRegisterCheckPath(cfg: EbmConfig): string | undefined {
  return cfg.endpoints.registerCheck
}

export function getEbmItemSyncPath(cfg: EbmConfig): string | undefined {
  return cfg.endpoints.itemSync
}

export function formatEbmNetworkError(message: string, cfg: EbmConfig): string {
  const target = cfg.proxyUrl || getEbmInvoiceUrl(cfg)
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Unable to connect/i.test(message)) {
    return (
      `Cannot reach RRA EBM API (${target}). ` +
      "Verify EBM_BASE_URL, network access, or set EBM_PROXY_URL to a reachable proxy."
    )
  }
  return message
}

export function listMissingEbmConfigFields(cfg: EbmConfig | null): string[] {
  if (!cfg) {
    return ["EBM_SECURITY_KEY", "EBM_BASE_URL", "EBM_INVOICE_PATH", "EBM_REGISTER_PATH"]
  }
  const missing: string[] = []
  if (!cfg.securityKey) missing.push("EBM_SECURITY_KEY")
  if (!cfg.baseUrl) missing.push("EBM_BASE_URL")
  if (!cfg.endpoints.invoice) missing.push("EBM_INVOICE_PATH")
  if (!cfg.endpoints.register) missing.push("EBM_REGISTER_PATH")
  return missing
}
