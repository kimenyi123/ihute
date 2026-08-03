/** Browser-side EBM debug helpers — full request/response visibility in console + UI. */

export type EbmApprovalApiResponse = {
  ok?: boolean
  error?: string
  errorMessage?: string
  internalError?: string
  statusCode?: number
  requestPayload?: unknown
  responsePayload?: unknown
  endpoint?: string
  method?: string
  debug?: {
    requestPayload?: unknown
    responsePayload?: unknown
    statusCode?: number
    errorMessage?: string
    endpoint?: string
    method?: string
  }
}

export type EbmDebugView = {
  userMessage: string
  internalError: string
  statusCode: number
  endpoint: string
  method: string
  requestPayload: unknown
  responsePayload: unknown
}

export function extractEbmDebug(json: EbmApprovalApiResponse): EbmDebugView {
  const debug = json.debug
  return {
    userMessage: String(json.error || json.errorMessage || "EBM approval failed"),
    internalError: String(
      json.internalError || debug?.errorMessage || json.errorMessage || json.error || "",
    ),
    statusCode: Number(json.statusCode ?? debug?.statusCode ?? 0),
    endpoint: String(debug?.endpoint || json.endpoint || "(unknown)"),
    method: String(debug?.method || json.method || "POST"),
    requestPayload: json.requestPayload ?? debug?.requestPayload ?? null,
    responsePayload: json.responsePayload ?? debug?.responsePayload ?? null,
  }
}

function pretty(value: unknown): string {
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

/** Print full EBM approval result to browser DevTools console (F12). */
export function logEbmApprovalToConsole(label: string, json: EbmApprovalApiResponse): EbmDebugView {
  const view = extractEbmDebug(json)
  console.log(`
==========================
EBM APPROVAL ${label.toUpperCase()}
==========================
User message: ${view.userMessage}
Internal error: ${view.internalError || "(none)"}
HTTP status: ${view.statusCode}
Endpoint: ${view.endpoint}
Method: ${view.method}
--- REQUEST ---
${pretty(view.requestPayload)}
--- RESPONSE ---
${pretty(view.responsePayload)}
==========================`)
  return view
}

export function formatEbmDebugSummary(view: EbmDebugView): string {
  return [
    view.userMessage,
    "",
    `HTTP ${view.statusCode} · ${view.method} ${view.endpoint}`,
    view.internalError && view.internalError !== view.userMessage
      ? `Internal: ${view.internalError}`
      : "",
    "",
    "Open DevTools (F12) → Console for full request/response JSON.",
  ]
    .filter(Boolean)
    .join("\n")
}
