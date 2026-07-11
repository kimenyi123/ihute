export {
  logEbmRequest,
  logEbmResponse,
  logEbmError,
  redactSecurityKey,
} from "./utils/ebm-logger"

/** @deprecated Use logEbmRequest / logEbmResponse instead */
export function ebmLog(_action: string, details: Record<string, unknown>): void {
  console.info("[EBM]", JSON.stringify({ ts: new Date().toISOString(), ...details }))
}

export function truncateForLog(value: string, max = 1200): string {
  const s = value.trim()
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}
