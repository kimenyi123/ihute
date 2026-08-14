import {
  isValidUrubutoMtnOrAirtel,
  normalizeUrubutoPhone,
  urubutoPhoneHint,
} from "@/lib/urubuto-phone"

/** Same Rwanda MTN/Airtel MSISDN rules as Urubuto wallet. */
export const normalizeAzamPayPhone = normalizeUrubutoPhone
export const isValidAzamPayMtnOrAirtel = isValidUrubutoMtnOrAirtel
export const azamPayPhoneHint = urubutoPhoneHint

/** Poll every 4s, cap ~2.5 minutes (plan §7: 3–5s, ~2–3 min). */
export const AZAMPAY_POLL_INTERVAL_MS = 4_000
export const AZAMPAY_POLL_MAX_MS = 150_000

export type AzamPayEligibility = {
  ok: boolean
  eligible: boolean
  enabled?: boolean
  hasCredentials?: boolean
  message?: string
}

export type AzamPayCheckoutPayResult = {
  ok: boolean
  referenceId?: string
  pgReferenceId?: string
  transactionStatus?: string
  message?: string
  provider?: string
  orderId?: string
  error?: string
}

export type AzamPayCheckoutStatusResult = {
  ok: boolean
  referenceId?: string
  pgReferenceId?: string
  transactionStatus?: string
  providerReferenceId?: string
  message?: string
  error?: string
}

export function inferAzamPayProvider(normalizedPhone: string): "mtn" | "airtel" | "" {
  if (!normalizedPhone || normalizedPhone.length < 5) return ""
  const local = normalizedPhone.startsWith("250")
    ? normalizedPhone.slice(3, 5)
    : normalizedPhone.slice(0, 2)
  if (local === "78" || local === "79") return "mtn"
  if (local === "72" || local === "73") return "airtel"
  return ""
}

/** Platform AzamPay availability (optional seller for allowlist). */
export async function fetchAzamPayEligibility(sellerAccount?: string): Promise<AzamPayEligibility> {
  try {
    const q =
      sellerAccount && sellerAccount.trim()
        ? `?account=${encodeURIComponent(sellerAccount.trim())}`
        : ""
    const res = await fetch(`/api/checkout/azampay-eligibility${q}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    return {
      ok: !!data.ok,
      eligible: !!data.eligible,
      enabled: data.enabled === true,
      hasCredentials: data.hasCredentials === true,
      message: typeof data.message === "string" ? data.message : undefined,
    }
  } catch {
    return { ok: false, eligible: false, message: "Could not reach AzamPay" }
  }
}

export async function initiateCheckoutAzamPayPay(payload: {
  orderId: number | string
  amount: number
  msisdn: string
  provider?: string
  fullName?: string
}): Promise<AzamPayCheckoutPayResult> {
  try {
    const phone = normalizeAzamPayPhone(payload.msisdn)
    const provider =
      (payload.provider || "").trim().toLowerCase() || inferAzamPayProvider(phone) || undefined
    const body: Record<string, unknown> = {
      orderId: payload.orderId,
      amount: payload.amount,
      msisdn: phone || payload.msisdn,
      fullName: payload.fullName,
    }
    const oidNum = Number(payload.orderId)
    if (!Number.isFinite(oidNum) || oidNum <= 0) {
      return { ok: false, error: "orderId must be a positive IHUTE order id (create the order first)" }
    }
    body.orderId = oidNum
    if (provider) body.provider = provider

    const res = await fetch("/api/checkout/azampay-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        referenceId: data.referenceId,
        transactionStatus: data.transactionStatus,
        error: data.error || data.message || "AzamPay could not be started",
      }
    }
    return {
      ok: true,
      referenceId: data.referenceId,
      pgReferenceId: data.pgReferenceId ?? data.pg_reference_id,
      transactionStatus: data.transactionStatus ?? data.transaction_status,
      message: data.message,
      provider: data.provider,
      orderId: data.orderId != null ? String(data.orderId) : String(payload.orderId),
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "AzamPay failed" }
  }
}

export async function fetchCheckoutAzamPayStatus(query: {
  pgReferenceId?: string
  referenceId?: string
  orderId?: string | number
}): Promise<AzamPayCheckoutStatusResult> {
  const params = new URLSearchParams()
  if (query.pgReferenceId?.trim()) params.set("pgReferenceId", query.pgReferenceId.trim())
  if (query.referenceId?.trim()) params.set("referenceId", query.referenceId.trim())
  if (query.orderId != null && String(query.orderId).trim()) {
    params.set("orderId", String(query.orderId).trim())
  }
  if ([...params.keys()].length === 0) {
    return { ok: false, error: "pgReferenceId, referenceId, or orderId is required" }
  }
  try {
    const res = await fetch(`/api/checkout/azampay-status?${params.toString()}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || data.message || "Could not check AzamPay status" }
    }
    return {
      ok: true,
      referenceId: data.referenceId ?? data.reference_id,
      pgReferenceId: data.pgReferenceId ?? data.pg_reference_id,
      transactionStatus: data.transactionStatus ?? data.transaction_status,
      providerReferenceId: data.providerReferenceId ?? data.provider_reference_id,
      message: data.message,
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not check AzamPay status" }
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll AzamPay until success/failure or timeout (~2.5 min).
 * Matches Urubuto MoMo waiting UX with longer cap per plan §7.
 */
export async function waitForAzamPayCompletion(query: {
  pgReferenceId?: string
  referenceId?: string
  orderId?: string | number
}): Promise<"success" | "failure" | "timeout"> {
  const deadline = Date.now() + AZAMPAY_POLL_MAX_MS
  let first = true
  while (Date.now() < deadline) {
    await wait(first ? 2_500 : AZAMPAY_POLL_INTERVAL_MS)
    first = false
    const status = await fetchCheckoutAzamPayStatus(query)
    const normalized = (status.transactionStatus ?? "").toLowerCase()
    if (normalized === "success") return "success"
    if (normalized === "failure" || normalized === "failed") return "failure"
  }
  return "timeout"
}
