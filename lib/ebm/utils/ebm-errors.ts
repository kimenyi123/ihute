/** Parse Algorithm / Ishyiga VSDC error JSON into readable messages (server logs). */

export function formatEbmApiErrorBody(rawText: string, companyTin?: string): string {
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    return rawText.slice(0, 400)
  }

  const errors = parsed.errors
  const messages: string[] = []
  if (Array.isArray(errors)) {
    for (const e of errors) {
      if (e != null && String(e).trim()) messages.push(String(e).trim())
    }
  }

  const joined = messages.join("; ") || String(parsed.status ?? parsed.message ?? "").trim()

  if (/register first|no parameter found/i.test(joined)) {
    const tin = companyTin?.trim() || "your TIN"
    return (
      `Company TIN ${tin} is not registered on the VSDC server for this security_key. ` +
      `Server said: ${joined}`
    )
  }

  if (/provide company tin|company tin/i.test(joined)) {
    return `Missing or invalid companyTin. Set EBM_COMPANY_TIN in .env.local. Server said: ${joined}`
  }

  if (joined) return joined

  return rawText.slice(0, 400)
}

export function formatEbmHttpError(httpStatus: number, rawText: string, companyTin?: string): string {
  const detail = formatEbmApiErrorBody(rawText, companyTin)
  return httpStatus > 0 ? `EBM HTTP ${httpStatus}: ${detail}` : detail
}

/** Detect VSDC responses that require company parameter registration first. */
export function isEbmRegistrationRequiredError(httpStatus: number, rawText: string): boolean {
  if (httpStatus !== 400 && httpStatus !== 422) return false
  const body = rawText.toLowerCase()
  return (
    /register first/.test(body) ||
    /no parameter found/.test(body) ||
    (/security_key/.test(body) && /register/.test(body))
  )
}

export type EbmUserErrorContext = "approval" | "registration" | "configuration"

/** Safe messages for frontend — never expose raw VSDC errors in user-facing text. */
export function toEbmUserFacingError(
  context: EbmUserErrorContext,
  _internalError?: string,
): string {
  switch (context) {
    case "registration":
      return toEbmUserFacingRegistrationError()
    case "configuration":
      return "EBM is not configured on this server. Contact your administrator."
    case "approval":
    default:
      return "EBM invoice approval failed. Please try again or contact support."
  }
}

export function toEbmUserFacingRegistrationError(cfg?: {
  baseUrl?: string
  proxyUrl?: string
}): string {
  const base = cfg?.baseUrl ?? process.env.EBM_BASE_URL ?? ""
  const onTestServer = /algorithm\.bi/i.test(base)
  const hasProxy = Boolean(cfg?.proxyUrl || process.env.EBM_PROXY_URL?.trim())

  if (onTestServer && !hasProxy) {
    return (
      "Company TIN is not registered on the VSDC test server. " +
      "Ask Algorithm/Ishyiga to register your TIN, OR set EBM_BASE_URL to production " +
      "with EBM_PROXY_URL pointing to a reachable proxy."
    )
  }

  return "Company TIN is not registered on the VSDC server. Automatic registration failed."
}
