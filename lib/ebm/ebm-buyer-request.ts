import { fetchPublicOrderForEbm } from "@/lib/ebm/fetch-order-for-ebm"
import { EbmRepository } from "@/lib/ebm/ebm-repository"
import { ebmSellerNotificationService } from "@/lib/ebm/ebm-seller-notification"
import { ebmService, type EbmServiceResult } from "@/lib/ebm/ebm-service"
import type { EbmFiscalStatus } from "@/lib/ebm/types"

export type BuyerEbmFiscalInfo = {
  invoiceNumber: string
  receiptNumber: string | null
  qrCode: string | null
  fiscalSignature: string | null
  sdcId: string | null
  internalData: string | null
  mrc: string | null
  timeSdc: string | null
  invoiceDate: string | null
  rawRequest: unknown
  rawResponse: unknown
}

export type BuyerEbmRequestResult = {
  ok: boolean
  orderId: number
  ebmStatus: EbmFiscalStatus | "not_requested"
  message?: string
  error?: string
  alreadyFiscalized?: boolean
  awaitingApproval?: boolean
  rejected?: boolean
  /** Populated when EBM fiscalization succeeded — for tax invoice UI. */
  fiscal?: BuyerEbmFiscalInfo
}

export class EbmBuyerRequestService {
  private readonly repo = new EbmRepository()

  async getStatus(orderId: number): Promise<BuyerEbmRequestResult> {
    const existing = await this.repo.findByOrderId(orderId).catch(() => null)
    if (!existing) {
      return { ok: true, orderId, ebmStatus: "not_requested" }
    }

    let fiscal: BuyerEbmFiscalInfo | undefined
    if (existing.ebm_status === "success") {
      const row = await this.repo.findFiscalPresentationByOrderId(orderId).catch(() => null)
      if (row) {
        fiscal = {
          invoiceNumber: row.invoice_number,
          receiptNumber: row.receipt_number,
          qrCode: row.qr_code,
          fiscalSignature: row.fiscal_signature,
          sdcId: row.vsdc_id,
          internalData: row.ysdcintdata,
          mrc: row.ysdcmrc,
          timeSdc: row.ysdctime || row.ysdcmrctim,
          invoiceDate: row.sent_at,
          rawRequest: row.raw_request,
          rawResponse: row.raw_response,
        }
      }
    }

    return {
      ok: true,
      orderId,
      ebmStatus: existing.ebm_status,
      alreadyFiscalized: existing.ebm_status === "success",
      awaitingApproval: existing.ebm_status === "pending",
      rejected: existing.ebm_status === "rejected",
      fiscal,
      message:
        existing.ebm_status === "success"
          ? "Invoice fiscalized"
          : existing.ebm_status === "pending"
            ? "Awaiting seller approval"
            : existing.ebm_status === "rejected"
              ? "Seller rejected this EBM request"
              : undefined,
    }
  }

  /** Buyer taps Request EBM — queues approval + notifies seller dashboard. */
  async requestFromBuyer(orderId: number): Promise<BuyerEbmRequestResult> {
    const order = await fetchPublicOrderForEbm(orderId)
    if (!order) {
      return { ok: false, orderId, ebmStatus: "not_requested", error: "Order not found" }
    }

    const existing = await this.repo.findByOrderId(orderId).catch(() => null)
    if (existing?.ebm_status === "success") {
      return {
        ok: true,
        orderId,
        ebmStatus: "success",
        alreadyFiscalized: true,
        message: "Invoice already fiscalized with RRA EBM",
      }
    }
    if (existing?.ebm_status === "pending") {
      return {
        ok: true,
        orderId,
        ebmStatus: "pending",
        awaitingApproval: true,
        message: "EBM request already sent — seller will approve shortly",
      }
    }
    if (existing?.ebm_status === "rejected") {
      await this.repo.saveBuyerRequest({
        orderId,
        invoiceNumber: order.orderNumber.trim() || `ORD-${order.orderId}`,
        buyerName: order.buyerName,
        sellerAccount: order.sellerAccount,
      })
      try {
        await ebmSellerNotificationService.notifySellerApprovalRequest({
          orderId: order.orderId,
          sellerAccount: order.sellerAccount,
          buyerName: order.buyerName,
          buyerPhone: order.buyerPhone,
          amount: order.amount,
          shopName: order.sellerName,
        })
      } catch (e: unknown) {
        console.error("[EbmBuyerRequest] re-request notification failed:", e)
      }
      return {
        ok: true,
        orderId,
        ebmStatus: "pending",
        awaitingApproval: true,
        message: "EBM request sent again — seller notified to approve invoice",
      }
    }

    const invoiceNumber = order.orderNumber.trim() || `ORD-${order.orderId}`
    await this.repo.saveBuyerRequest({
      orderId,
      invoiceNumber,
      buyerName: order.buyerName,
      sellerAccount: order.sellerAccount,
    })

    try {
      await ebmSellerNotificationService.notifySellerApprovalRequest({
        orderId: order.orderId,
        sellerAccount: order.sellerAccount,
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        amount: order.amount,
        shopName: order.sellerName,
      })
    } catch (e: unknown) {
      console.error("[EbmBuyerRequest] notification failed:", e)
      return {
        ok: false,
        orderId,
        ebmStatus: "pending",
        error:
          e instanceof Error
            ? `Request saved but seller notification failed: ${e.message}`
            : "Seller notification failed",
      }
    }

    return {
      ok: true,
      orderId,
      ebmStatus: "pending",
      awaitingApproval: true,
      message: "EBM request sent — seller notified to approve invoice",
    }
  }

  /** Seller approves from dashboard → fiscalize via RRA API. */
  async approveFromSeller(orderId: number, sellerAccount: string, userName?: string): Promise<EbmServiceResult> {
    const order = await fetchPublicOrderForEbm(orderId)
    if (!order) {
      return { ok: false, orderId, invoiceNumber: "", ebmStatus: "failed", error: "Order not found" }
    }
    if (order.sellerAccount.trim() !== sellerAccount.trim()) {
      return {
        ok: false,
        orderId,
        invoiceNumber: "",
        ebmStatus: "failed",
        error: "This order does not belong to your shop",
      }
    }

    const result = await ebmService.requestFiscalization(orderId, undefined, {
      userName: userName || sellerAccount,
      force: false,
      sellerApproved: true,
    })

    if (result.ok) {
      await ebmSellerNotificationService.markReadForOrder(sellerAccount, orderId).catch(() => {})
    }

    return result
  }

  /** Seller rejects fake/invalid order — no RRA call. */
  async rejectFromSeller(orderId: number, sellerAccount: string, reason?: string) {
    const order = await fetchPublicOrderForEbm(orderId)
    if (!order) {
      return { ok: false, orderId, error: "Order not found" }
    }
    if (order.sellerAccount.trim() !== sellerAccount.trim()) {
      return { ok: false, orderId, error: "This order does not belong to your shop" }
    }

    const updated = await this.repo.rejectSellerRequest({
      orderId,
      sellerAccount,
      reason,
    })
    if (!updated) {
      return {
        ok: false,
        orderId,
        error: "No pending EBM request found for this order (already approved or rejected)",
      }
    }

    await ebmSellerNotificationService.markReadForOrder(sellerAccount, orderId).catch(() => {})

    return {
      ok: true,
      orderId,
      ebmStatus: "rejected" as const,
      message: "EBM request rejected",
    }
  }
}

export const ebmBuyerRequestService = new EbmBuyerRequestService()
