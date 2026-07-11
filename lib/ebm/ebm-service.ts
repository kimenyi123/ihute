import { getBackendBase } from "@/lib/backend-config"
import { getEbmConfigFromEnv, getEbmSetupHint, getEbmInvoiceUrl, getEbmRegisterPath } from "@/lib/ebm/config"
import { loadEbmConfigResolved } from "@/lib/ebm/ebm-platform-config"
import { resolveEbmCompanyTin } from "@/lib/ebm/resolve-company-tin"
import { EbmClient } from "@/lib/ebm/ebm-client"
import { isOrderEligibleForAutoEbm } from "@/lib/ebm/ebm-eligibility"
import { fetchFullOrderForEbm, toAdminOrderHeader } from "@/lib/ebm/fetch-order-for-ebm"
import { mapOrderToEbmInvoice } from "@/lib/ebm/ebm-invoice-mapper"
import { EbmRepository } from "@/lib/ebm/ebm-repository"
import {
  isEbmRegistrationRequiredError,
  toEbmUserFacingError,
  toEbmUserFacingRegistrationError,
} from "@/lib/ebm/ebm-api-errors"
import { ebmRegistrationService } from "@/lib/ebm/ebm-registration-service"
import { parseEbmResponse } from "@/lib/ebm/ebm-response-parser"
import type { EbmDebugEnvelope } from "@/lib/ebm/dto/api-result.dto"
import type { AdminOrderHeader, AdminOrderLine, EbmFiscalStatus } from "@/lib/ebm/types"

export type EbmServiceResult = {
  ok: boolean
  orderId: number
  invoiceNumber: string
  ebmStatus: EbmFiscalStatus
  receiptNumber?: string | null
  qrCode?: string | null
  fiscalSignature?: string | null
  error?: string
  duplicate?: boolean
  /** Raw VSDC request/response for frontend debugging. */
  debug?: EbmDebugEnvelope
}

async function fetchAdminOrderDetails(
  orderId: number,
  forwardHeaders?: Headers,
): Promise<{ order: AdminOrderHeader; items: AdminOrderLine[] } | null> {
  const url = `${getBackendBase()}/AdminServlet`
  const form = new URLSearchParams({
    action: "getOrderDetails",
    orderId: String(orderId),
  })
  const h: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  }
  const cookie = forwardHeaders?.get("cookie")
  if (cookie) h.Cookie = cookie
  const adminEmail = forwardHeaders?.get("x-admin-email")
  if (adminEmail) h["X-Admin-Email"] = adminEmail

  const res = await fetch(url, {
    method: "POST",
    headers: h,
    body: form.toString(),
    cache: "no-store",
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
  if (!data.ok) return null

  const o = (data.order ?? {}) as Record<string, unknown>
  const itemsRaw = Array.isArray(data.items) ? data.items : []

  const order: AdminOrderHeader = {
    id: Number(o.id) || orderId,
    orderNumber: String(o.orderNumber ?? ""),
    sellerName: String(o.sellerName ?? ""),
    sellerAccount: String(o.sellerAccount ?? ""),
    sellerTin: String(o.sellerTin ?? o.SELLER_TIN ?? o.seller_tin ?? ""),
    buyerName: String(o.buyerName ?? ""),
    buyerAccount: String(o.buyerAccount ?? ""),
    buyerTin: String(o.buyerTin ?? o.BUYER_TIN ?? ""),
    amount: Number(o.amount) || 0,
    taxes: Number(o.taxes) || 0,
    paymentStatus: String(o.paymentStatus ?? ""),
    orderStatus: String(o.orderStatus ?? ""),
    timestamp: String(o.timestamp ?? ""),
    currency: "RWF",
  }

  const items: AdminOrderLine[] = itemsRaw.map((row) => {
    const r = row as Record<string, unknown>
    return {
      itemCode: String(r.itemCode ?? r.ITEM_CODE ?? ""),
      itemName: String(r.itemName ?? r.ITEM_NAME ?? ""),
      quantity: Number(r.quantity ?? r.QUANTITY) || 0,
      unitPrice: Number(r.unitPrice ?? r.UNITY_PRICE) || 0,
      discountAmount: Number(r.discountAmount ?? r.DISCOUNT_AMOUNT) || 0,
      vatRate: Number(r.vatRate ?? r.VAT_RATE) || 0,
    }
  })

  return { order, items }
}

async function fetchOrderDetailsForEbm(
  orderId: number,
  forwardHeaders?: Headers,
): Promise<{ order: AdminOrderHeader; items: AdminOrderLine[] } | null> {
  const admin = await fetchAdminOrderDetails(orderId, forwardHeaders)
  if (admin) return admin
  const pub = await fetchFullOrderForEbm(orderId)
  if (!pub) return null
  return { order: toAdminOrderHeader(pub.header), items: pub.items }
}

function parseRawResponse(rawText: string): unknown {
  if (!rawText.trim()) return null
  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

function buildDebugFromResult(
  requestPayload: unknown,
  result: {
    httpStatus: number
    rawText: string
    body: unknown
    error?: string
    endpoint?: string
    method?: string
  },
): EbmDebugEnvelope {
  return {
    requestPayload,
    responsePayload: result.body ?? parseRawResponse(result.rawText),
    statusCode: result.httpStatus,
    errorMessage: result.error,
    endpoint: result.endpoint,
    method: result.method,
  }
}

/**
 * Fiscalization orchestration service.
 *
 * Request flow:
 * 1. Load EBM config (env → MySQL fallback)
 * 2. Load order details
 * 3. Map order → VSDC invoice JSON (mapper)
 * 4. ensureRegistered() — register company if needed
 * 5. EbmClient.postInvoiceWithRetry() — real HTTP to VSDC
 * 6. On "register first" → registerCompany() + retry once
 * 7. Persist raw request/response in ebm_invoices
 * 8. Return debug envelope to API controller
 */
export class EbmService {
  private readonly repo = new EbmRepository()

  async requestFiscalization(
    orderId: number,
    forwardHeaders?: Headers,
    options?: { userName?: string; force?: boolean; sellerApproved?: boolean },
  ): Promise<EbmServiceResult> {
    const cfg = await loadEbmConfigResolved()
    if (!cfg) {
      console.error(`[EbmService] order=${orderId} FAILED — EBM not configured`)
      return {
        ok: false,
        orderId,
        invoiceNumber: "",
        ebmStatus: "failed",
        error: getEbmSetupHint(),
      }
    }

    const details = await fetchOrderDetailsForEbm(orderId, forwardHeaders)
    if (!details) {
      return {
        ok: false,
        orderId,
        invoiceNumber: "",
        ebmStatus: "failed",
        error: "Could not load order details from AdminServlet",
      }
    }

    const { order, items } = details
    const invoiceNumber = order.orderNumber?.trim() || `ORD-${order.id}`

    if (!options?.force) {
      const existing = await this.repo.findByOrderId(orderId)
      if (existing?.ebm_status === "success") {
        return {
          ok: true,
          orderId,
          invoiceNumber: existing.invoice_number,
          ebmStatus: "success",
          receiptNumber: existing.receipt_number,
          qrCode: existing.qr_code,
          duplicate: true,
        }
      }
      if (existing?.ebm_status === "pending" && !options?.sellerApproved) {
        return {
          ok: false,
          orderId,
          invoiceNumber: existing.invoice_number,
          ebmStatus: "pending",
          error: "EBM awaiting seller approval — use Approve EBM Invoice on seller dashboard",
        }
      }
      if (existing?.ebm_status === "rejected" && !options?.sellerApproved) {
        return {
          ok: false,
          orderId,
          invoiceNumber: existing.invoice_number,
          ebmStatus: "rejected",
          error: "Seller rejected this EBM request",
        }
      }
    }

    const companyTin = (await resolveEbmCompanyTin(order)) || cfg.companyTin || ""
    console.log(
      `[EbmService] order=${orderId} config baseUrl=${cfg.baseUrl} companyTin=${companyTin} invoicePath=${cfg.endpoints.invoice}`,
    )
    if (!companyTin.trim()) {
      return {
        ok: false,
        orderId,
        invoiceNumber: order.orderNumber?.trim() || `ORD-${order.id}`,
        ebmStatus: "failed",
        error:
          "EBM_COMPANY_TIN is not set. Add it to .env.local or register the seller TIN in account_signup.",
      }
    }

    const payload = mapOrderToEbmInvoice({
      order,
      items,
      companyTin,
      userName: options?.userName,
      callbackUrl: process.env.EBM_CALLBACK_URL?.trim() || "",
    })

    console.log(`[EbmService] order=${orderId} invoice payload:\n${JSON.stringify(payload, null, 2)}`)

    const userName =
      options?.userName || order.sellerName || process.env.EBM_DEFAULT_USERNAME?.trim() || ""
    const client = new EbmClient(cfg)

    const registration = await ebmRegistrationService.ensureRegistered({
      cfg,
      companyTin,
      userName,
      sellerName: order.sellerName,
      orderId,
      items,
    })

    if (!registration.ok && registration.status === "failed") {
      console.error(
        `[EbmService] order=${orderId} registration FAILED: ${registration.error ?? "unknown"}`,
      )
      const ebmStatus: EbmFiscalStatus = "failed"
      await this.repo.saveAttempt({
        orderId,
        invoiceNumber,
        sellerAccount: order.sellerAccount,
        rawRequest: payload,
        status: ebmStatus,
        rawResponseText: registration.rawText ?? "",
        errorMessage: registration.error ?? toEbmUserFacingRegistrationError(cfg),
        sentAt: new Date(),
        responseAt: new Date(),
      })
      return {
        ok: false,
        orderId,
        invoiceNumber,
        ebmStatus,
        error: toEbmUserFacingRegistrationError(cfg),
        debug: {
          requestPayload: payload,
          responsePayload: parseRawResponse(registration.rawText ?? ""),
          statusCode: 0,
          errorMessage: registration.error,
          endpoint: `${cfg.baseUrl}${getEbmRegisterPath(cfg)}`,
          method: "POST",
        },
      }
    }

    const sentAt = new Date()
    console.log(`[EbmService] order=${orderId} posting invoice → ${getEbmInvoiceUrl(cfg)}`)
    let result = await client.postInvoiceWithRetry(payload)
    let responseAt = new Date()
    let parsed = parseEbmResponse(result.body)

    if (
      !result.ok &&
      (result.registrationRequired ||
        isEbmRegistrationRequiredError(result.httpStatus, result.rawText))
    ) {
      const regRetry = await ebmRegistrationService.registerCompany({
        cfg,
        companyTin,
        userName,
        sellerName: order.sellerName,
        orderId,
        items,
        force: true,
      })

      if (regRetry.ok) {
        sentAt.setTime(Date.now())
        result = await client.postInvoice(payload)
        responseAt = new Date()
        parsed = parseEbmResponse(result.body)
      } else {
        await this.repo.saveAttempt({
          orderId,
          invoiceNumber,
          sellerAccount: order.sellerAccount,
          rawRequest: payload,
          status: "failed",
          rawResponseText: regRetry.rawText ?? result.rawText,
          errorMessage: regRetry.error ?? result.error,
          sentAt,
          responseAt,
        })
        return {
          ok: false,
          orderId,
          invoiceNumber,
          ebmStatus: "failed",
          error: toEbmUserFacingRegistrationError(cfg),
          debug: buildDebugFromResult(payload, result),
        }
      }
    }

    const isDuplicate = /duplicate|already exists/i.test(result.rawText)
    const ebmStatus: EbmFiscalStatus = result.ok
      ? "success"
      : isDuplicate
        ? "success"
        : result.errorKind === "timeout" || result.errorKind === "network" || result.errorKind === "http"
          ? "retry"
          : "failed"

    await this.repo.saveAttempt({
      orderId,
      invoiceNumber,
      sellerAccount: order.sellerAccount,
      rawRequest: payload,
      status: ebmStatus,
      parsed: parsed.success ? parsed : undefined,
      rawResponseText: result.rawText,
      errorMessage: result.error,
      sentAt,
      responseAt,
    })

    const debug = buildDebugFromResult(payload, result)

    if (!result.ok && !isDuplicate) {
      return {
        ok: false,
        orderId,
        invoiceNumber,
        ebmStatus,
        error: toEbmUserFacingError("approval", result.error),
        debug,
      }
    }

    if (!parsed.success && result.ok) {
      return {
        ok: false,
        orderId,
        invoiceNumber,
        ebmStatus: "failed",
        error: parsed.status || "EBM returned non-success status",
        debug,
      }
    }

    return {
      ok: true,
      orderId,
      invoiceNumber,
      ebmStatus: "success",
      receiptNumber: parsed.receiptNumber,
      qrCode: parsed.qrCode,
      fiscalSignature: parsed.fiscalSignature,
      debug,
    }
  }

  async maybeAutoFiscalize(orderId: number, forwardHeaders?: Headers): Promise<EbmServiceResult | null> {
    const existing = await this.repo.findByOrderId(orderId).catch(() => null)
    if (existing?.ebm_status === "pending") {
      console.info(`[EbmService] skip auto-fiscalize order=${orderId} — awaiting seller approval`)
      return null
    }
    const details = await fetchOrderDetailsForEbm(orderId, forwardHeaders)
    if (!details || !isOrderEligibleForAutoEbm(details.order)) return null
    return this.requestFiscalization(orderId, forwardHeaders)
  }

  async retryPendingBatch(limit = 20, forwardHeaders?: Headers): Promise<{
    processed: number
    succeeded: number
    failed: number
    results: EbmServiceResult[]
  }> {
    const cfg = getEbmConfigFromEnv()
    if (!cfg) {
      return { processed: 0, succeeded: 0, failed: 0, results: [] }
    }

    const maxRetries = Math.max(cfg.retryAttempts + 1, 5)
    const candidates = await this.repo.listRetryCandidates(limit, maxRetries)
    const results: EbmServiceResult[] = []
    let succeeded = 0
    let failed = 0

    for (const row of candidates) {
      const result = await this.requestFiscalization(row.order_id, forwardHeaders, { force: true })
      results.push(result)
      if (result.ok) succeeded++
      else failed++
    }

    return { processed: candidates.length, succeeded, failed, results }
  }
}

export const ebmService = new EbmService()
