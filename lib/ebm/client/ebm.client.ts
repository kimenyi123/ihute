/**
 * Dedicated HTTP client for RRA VSDC / EBM API.
 *
 * Flow:
 * 1. Service builds business payload (mapper)
 * 2. EbmHttpClient.send() performs auth headers, timeout, logging, fetch
 * 3. Raw response text is returned unchanged to the service layer
 */

import type { EbmConfig } from "@/lib/ebm/config"
import { formatEbmNetworkError, getEbmPostUrl } from "@/lib/ebm/config"
import { logEbmError, logEbmRequest, logEbmResponse } from "@/lib/ebm/utils/ebm-logger"

export type EbmSendOptions = {
  path: string
  method?: "GET" | "POST"
  body?: unknown
  query?: Record<string, string>
  companyTin?: string
}

export type EbmSendResult = {
  ok: boolean
  httpStatus: number
  rawText: string
  body: unknown
  endpoint: string
  method: string
  requestPayload: unknown
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  error?: string
  errorKind?: "timeout" | "network" | "http" | "parse"
}

function resolveDirectUrl(cfg: EbmConfig, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${cfg.baseUrl.replace(/\/$/, "")}${normalized}`
}

function buildRequestHeaders(cfg: EbmConfig, viaProxy: boolean, path: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (viaProxy) {
    const secret = process.env.EBM_PROXY_SECRET?.trim()
    if (secret) headers["x-ebm-proxy-secret"] = secret
    headers["x-ebm-path"] = path.startsWith("/") ? path : `/${path}`
  } else {
    headers.security_key = cfg.securityKey
  }
  return headers
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export class EbmHttpClient {
  constructor(private readonly cfg: EbmConfig) {}

  /**
   * Send a single HTTP request to VSDC (direct or via proxy).
   * Logs request/response/error blocks to CMD before returning.
   */
  async send(options: EbmSendOptions): Promise<EbmSendResult> {
    const method = options.method ?? (options.body != null ? "POST" : "GET")
    const viaProxy = Boolean(this.cfg.proxyUrl)
    const path = options.path.startsWith("/") ? options.path : `/${options.path}`

    let endpoint = viaProxy ? getEbmPostUrl(this.cfg) : resolveDirectUrl(this.cfg, path)
    if (options.query && Object.keys(options.query).length > 0) {
      const qs = new URLSearchParams(options.query).toString()
      endpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${qs}`
    }

    const requestHeaders = buildRequestHeaders(this.cfg, viaProxy, path)
    if (method === "POST" && options.body != null) {
      requestHeaders["Content-Type"] = "application/json"
    }

    logEbmRequest({
      endpoint: viaProxy ? `${endpoint} (proxy → ${path})` : endpoint,
      method,
      headers: requestHeaders,
      payload: options.body ?? null,
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs)

    try {
      const res = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        body: method === "POST" && options.body != null ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      })

      const responseHeaders = headersToRecord(res.headers)
      let responseText = await res.text()
      let parsedBody: unknown = parseResponseBody(responseText)
      let httpStatus = res.status
      let httpOk = res.ok

      if (viaProxy) {
        const envelope = parsedBody as {
          ok?: boolean
          httpStatus?: number
          body?: unknown
          rawText?: string
          error?: string
        }
        if (!res.ok || envelope.ok === false) {
          const raw = typeof envelope.rawText === "string" ? envelope.rawText : responseText
          const status = envelope.httpStatus || res.status
          const errMsg = envelope.error || `EBM proxy HTTP ${res.status}`

          logEbmError({
            statusCode: status,
            message: errMsg,
            endpoint,
            requestPayload: options.body ?? null,
            fullResponse: envelope.body ?? raw,
          })

          return {
            ok: false,
            httpStatus: status,
            rawText: raw,
            body: envelope.body ?? parseResponseBody(raw),
            endpoint,
            method,
            requestPayload: options.body ?? null,
            requestHeaders,
            responseHeaders,
            error: errMsg,
            errorKind: "http",
          }
        }

        if (typeof envelope.rawText === "string" && envelope.rawText) {
          responseText = envelope.rawText
        }
        parsedBody = envelope.body ?? parseResponseBody(responseText)
        httpStatus = envelope.httpStatus || res.status
        httpOk = httpStatus >= 200 && httpStatus < 300
      }

      if (httpOk) {
        logEbmResponse({
          statusCode: httpStatus,
          headers: responseHeaders,
          body: parsedBody,
        })
        return {
          ok: true,
          httpStatus,
          rawText: responseText,
          body: parsedBody,
          endpoint,
          method,
          requestPayload: options.body ?? null,
          requestHeaders,
          responseHeaders,
        }
      }

      const errMsg = `HTTP ${httpStatus}`
      logEbmError({
        statusCode: httpStatus,
        message: errMsg,
        endpoint,
        requestPayload: options.body ?? null,
        fullResponse: parsedBody,
      })

      return {
        ok: false,
        httpStatus,
        rawText: responseText,
        body: parsedBody,
        endpoint,
        method,
        requestPayload: options.body ?? null,
        requestHeaders,
        responseHeaders,
        error: errMsg,
        errorKind: "http",
      }
    } catch (e: unknown) {
      const isAbort = e instanceof Error && e.name === "AbortError"
      const raw = isAbort ? "EBM request timeout" : e instanceof Error ? e.message : String(e)
      const errMsg = isAbort ? raw : formatEbmNetworkError(raw, this.cfg)

      logEbmError({
        statusCode: 0,
        message: errMsg,
        endpoint,
        requestPayload: options.body ?? null,
        fullResponse: null,
      })

      return {
        ok: false,
        httpStatus: 0,
        rawText: "",
        body: null,
        endpoint,
        method,
        requestPayload: options.body ?? null,
        requestHeaders,
        responseHeaders: {},
        error: errMsg,
        errorKind: isAbort ? "timeout" : "network",
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Retry transient failures with exponential backoff. */
  async sendWithRetry(options: EbmSendOptions): Promise<EbmSendResult> {
    const attempts = Math.max(1, this.cfg.retryAttempts + 1)
    let last: EbmSendResult | null = null

    for (let i = 0; i < attempts; i++) {
      const result = await this.send(options)
      last = result
      if (result.ok) return result

      const retryable =
        result.errorKind === "timeout" ||
        result.errorKind === "network" ||
        (result.errorKind === "http" && result.httpStatus >= 500)

      if (!retryable || i === attempts - 1) return result
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
    }

    return last!
  }
}

/** Invoice-specific client — delegates HTTP to EbmHttpClient. */
export class EbmClient {
  private readonly http: EbmHttpClient

  constructor(private readonly cfg: EbmConfig) {
    this.http = new EbmHttpClient(cfg)
  }

  getHttpClient(): EbmHttpClient {
    return this.http
  }

  async postInvoice(payload: unknown): Promise<EbmSendResult & { registrationRequired?: boolean }> {
    const { formatEbmHttpError, isEbmRegistrationRequiredError } = await import(
      "@/lib/ebm/utils/ebm-errors"
    )

    const res = await this.http.send({
      path: this.cfg.endpoints.invoice,
      method: "POST",
      body: payload,
      companyTin: (payload as { companyTin?: string })?.companyTin,
    })

    const registrationRequired = isEbmRegistrationRequiredError(res.httpStatus, res.rawText)
    if (!res.ok) {
      const companyTin = (payload as { companyTin?: string })?.companyTin
      return {
        ...res,
        error: formatEbmHttpError(res.httpStatus, res.rawText, companyTin),
        registrationRequired,
      }
    }

    return res
  }

  async postInvoiceWithRetry(payload: unknown): Promise<EbmSendResult & { registrationRequired?: boolean }> {
    const { isEbmRegistrationRequiredError } = await import("@/lib/ebm/utils/ebm-errors")

    const attempts = Math.max(1, this.cfg.retryAttempts + 1)
    let last: (EbmSendResult & { registrationRequired?: boolean }) | null = null

    for (let i = 0; i < attempts; i++) {
      const result = await this.postInvoice(payload)
      last = result
      if (result.ok) return result

      if (result.registrationRequired || isEbmRegistrationRequiredError(result.httpStatus, result.rawText)) {
        return result
      }

      const retryable =
        result.errorKind === "timeout" ||
        result.errorKind === "network" ||
        (result.errorKind === "http" && result.httpStatus >= 500)

      if (!retryable || i === attempts - 1) return result
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
    }

    return last!
  }
}

export { EbmHttpClient as default }
