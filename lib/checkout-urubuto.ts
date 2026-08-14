import { normalizeUrubutoPhone } from "@/lib/urubuto-phone"

/** Buyer checkout: is this seller (ALG payer code) live on UrubutoPay? */

export type SellerUrubutoEligibility = {
  ok: boolean
  eligible: boolean
  merchantId?: number | null
  message?: string
}

/** Urubuto staging only accepts BK Arena prepaid for CARD channel */
export const URUBUTO_CHECKOUT_CARD_TYPE = "BK_ARENA_PREPAID_CARD" as const

export type UrubutoCheckoutPaymentMethod = "WALLET" | "CARD"

export async function fetchSellerUrubutoEligibility(sellerAccount: string): Promise<SellerUrubutoEligibility> {
  const acc = sellerAccount.trim()
  if (!acc) return { ok: false, eligible: false, message: "Missing seller account" }
  try {
    const res = await fetch(
      `/api/checkout/urubuto-eligibility?account=${encodeURIComponent(acc)}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => ({}))
    return {
      ok: !!data.ok,
      eligible: !!data.eligible,
      merchantId: typeof data.merchantId === "number" ? data.merchantId : null,
      message: typeof data.message === "string" ? data.message : undefined,
    }
  } catch {
    return { ok: false, eligible: false, message: "Could not reach UrubutoPay" }
  }
}

export type UrubutoCheckoutPayResult = {
  ok: boolean
  transactionId?: string
  internalTransactionId?: string
  payerCode?: string
  status?: string
  message?: string
  cardProcessingUrl?: string
  error?: string
}

export type UrubutoCheckoutStatusResult = {
  ok: boolean
  transactionId?: string
  paymentStatus?: string
  receiptNumber?: string
  settlementStatus?: string
  error?: string
}

export async function initiateCheckoutUrubutoPay(payload: {
  sellerAccount: string
  amount: number
  paymentMethod?: UrubutoCheckoutPaymentMethod
  phone_number?: string
  card_type_to_be_used?: string
  payer_names?: string
  payer_email?: string
  payerCode?: string
  cartId?: string
  clientReference?: string
  /** IHUTE order id — used as merchant reference (IHUTE-ORDER-{id}) for webhook writeback. */
  orderId?: number
}): Promise<UrubutoCheckoutPayResult> {
  const paymentMethod: UrubutoCheckoutPaymentMethod = payload.paymentMethod ?? "WALLET"
  try {
    const body: Record<string, unknown> = {
      sellerAccount: payload.sellerAccount,
      amount: payload.amount,
      paymentMethod,
      payer_names: payload.payer_names,
      payer_email: payload.payer_email,
      payerCode: payload.payerCode,
      cartId: payload.cartId,
      clientReference: payload.clientReference,
    }
    if (payload.orderId && payload.orderId > 0) {
      body.orderId = payload.orderId
      body.ihute_order_id = payload.orderId
    }
    if (paymentMethod === "WALLET") {
      body.phone_number = normalizeUrubutoPhone(payload.phone_number)
    } else {
      body.card_type_to_be_used = URUBUTO_CHECKOUT_CARD_TYPE
    }

    const res = await fetch("/api/checkout/urubuto-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || data.message || "UrubutoPay could not be started",
      }
    }
    const cardProcessingUrl =
      (typeof data.cardProcessingUrl === "string" && data.cardProcessingUrl) ||
      (typeof data.card_processing_url === "string" && data.card_processing_url) ||
      undefined
    return {
      ok: true,
      transactionId: data.transactionId ?? data.transaction_id,
      internalTransactionId: data.internalTransactionId ?? data.internal_transaction_id,
      payerCode: data.payerCode ?? data.payer_code,
      status: data.status ?? data.paymentStatus,
      message: data.message,
      cardProcessingUrl,
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "UrubutoPay failed" }
  }
}

export async function fetchCheckoutUrubutoStatus(transactionId: string): Promise<UrubutoCheckoutStatusResult> {
  const tx = transactionId.trim()
  if (!tx) return { ok: false, error: "Missing transaction id" }
  try {
    const res = await fetch(`/api/checkout/urubuto-status?transactionId=${encodeURIComponent(tx)}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || data.message || "Could not check payment status" }
    }
    return {
      ok: true,
      transactionId: data.transactionId ?? data.transaction_id,
      paymentStatus: data.paymentStatus ?? data.payment_status,
      receiptNumber: data.receiptNumber ?? data.receipt_number,
      settlementStatus: data.settlementStatus ?? data.settlement_status,
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not check payment status" }
  }
}
