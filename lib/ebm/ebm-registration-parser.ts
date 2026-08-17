import { parseEbmResponse } from "./ebm-response-parser"
import type { EbmRegistrationResult } from "./ebm-registration-types"

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown
      if (j && typeof j === "object") return j as Record<string, unknown>
    } catch {
      return { rawText: raw }
    }
  }
  return {}
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return null
}

/** Parse VSDC company registration / parameter API response. */
export function parseEbmRegistrationResponse(
  raw: unknown,
  rawText = "",
): EbmRegistrationResult {
  const obj = asRecord(raw)
  const parsed = parseEbmResponse(raw)

  const nested = asRecord(obj.RESPONSE ?? obj.response)
  const message = asRecord(nested.MESSAGE ?? nested.message)

  const statusText =
    pickString(obj, "STATUS", "status") ??
    pickString(nested, "STATUS", "status") ??
    parsed.status

  const distributorTin =
    pickString(nested, "DISTRIBUTOR_TIN", "TAXPAYER_TIN") ??
    pickString(obj, "DISTRIBUTOR_TIN", "TAXPAYER_TIN")

  const vsdcId = parsed.ysdcid ?? pickString(message, "ysdcid", "YSDCID")

  const errors = obj.errors
  const errorMessages: string[] = []
  if (Array.isArray(errors)) {
    for (const e of errors) {
      if (e != null && String(e).trim()) errorMessages.push(String(e).trim())
    }
  }

  const joinedErrors = errorMessages.join("; ")
  const alreadyRegistered = /already registered|already exists/i.test(
    `${joinedErrors} ${rawText} ${statusText ?? ""}`,
  )

  const success =
    alreadyRegistered ||
    /success/i.test(statusText ?? "") ||
    parsed.success ||
    Boolean(vsdcId && /success/i.test(String(statusText)))

  if (success) {
    return {
      ok: true,
      status: "registered",
      vsdcId,
      distributorTin,
      rawText,
      alreadyRegistered,
    }
  }

  return {
    ok: false,
    status: "failed",
    vsdcId,
    distributorTin,
    rawText,
    error: joinedErrors || statusText || "Registration failed",
  }
}
