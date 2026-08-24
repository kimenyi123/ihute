/**
 * Ministry of Health eRx (FHIR) configuration — env only, never MySQL-backed.
 * MOH_ERX_BASE_URL / MOH_ERX_USERNAME / MOH_ERX_PASSWORD in .env / .env.local.
 */

export type MohErxConfig = {
  baseUrl: string
  username: string
  password: string
  timeoutMs: number
}

function readTimeoutMs(): number {
  return Math.max(3000, Number(process.env.MOH_ERX_TIMEOUT_MS) || 15000)
}

export function getMohErxConfigFromEnv(): MohErxConfig | null {
  const baseUrl = (process.env.MOH_ERX_BASE_URL || "").trim().replace(/\/+$/, "")
  const username = (process.env.MOH_ERX_USERNAME || "").trim()
  const password = process.env.MOH_ERX_PASSWORD || ""

  if (!baseUrl || !username || !password) return null

  return {
    baseUrl,
    username,
    password,
    timeoutMs: readTimeoutMs(),
  }
}

export function isMohErxConfigured(): boolean {
  return getMohErxConfigFromEnv() != null
}

export function getMohErxSetupHint(): string {
  return (
    "Configure MOH eRx: set MOH_ERX_BASE_URL, MOH_ERX_USERNAME, MOH_ERX_PASSWORD " +
    "in ihute-frontend/.env.local and restart npm run dev."
  )
}
