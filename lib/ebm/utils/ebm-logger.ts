/** CMD-visible request/response/error logging for VSDC HTTP calls. */

export function redactSecurityKey(key: string | undefined): string {
  const k = key?.trim() ?? ""
  if (!k) return "(empty)"
  if (k.length <= 8) return "***"
  return `${k.slice(0, 4)}…${k.slice(-4)}`
}

function prettyJson(value: unknown): string {
  if (value == null) return "(empty)"
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatHeaders(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([k, v]) => {
    const val = k.toLowerCase() === "security_key" ? redactSecurityKey(v) : v
    return `  ${k}: ${val}`
  })
  return lines.length ? lines.join("\n") : "  (none)"
}

export function logEbmRequest(args: {
  endpoint: string
  method: string
  headers: Record<string, string>
  payload?: unknown
}): void {
  console.log(`
==========================
EBM REQUEST
==========================
Endpoint: ${args.endpoint}
HTTP Method: ${args.method}
Headers:
${formatHeaders(args.headers)}
Payload:
${prettyJson(args.payload ?? null)}
==========================`)
}

export function logEbmResponse(args: {
  statusCode: number
  headers: Record<string, string>
  body: unknown
}): void {
  console.log(`
==========================
EBM RESPONSE
==========================
Status Code: ${args.statusCode}
Headers:
${formatHeaders(args.headers)}
Body:
${prettyJson(args.body)}
==========================`)
}

export function logEbmError(args: {
  statusCode: number
  message: string
  endpoint: string
  requestPayload?: unknown
  fullResponse?: unknown
}): void {
  console.error(`
==========================
EBM ERROR
==========================
Status Code: ${args.statusCode}
Message: ${args.message}
Endpoint: ${args.endpoint}
Request Payload:
${prettyJson(args.requestPayload ?? null)}
Full Response:
${prettyJson(args.fullResponse ?? null)}
==========================`)
}
