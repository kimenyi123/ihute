import {
  isValidRwMobileMoneyPhone,
  maskPhoneForDisplay,
  normalizeRwMobileMoneyPhone,
} from "./mobile-money-validation"
import { normalizePhoneDigitsForAuth } from "./rwanda-phone"

export type GrandmaCheckoutPaymentId = "momo" | "airtel" | "bk" | "cash"

export function isGrandmaMobileMoneyPayment(id: string): boolean {
  const t = id.trim().toLowerCase()
  return t === "momo" || t === "airtel"
}

export function isGrandmaMobileMoneyPaymentName(paymentName: string): boolean {
  const n = paymentName.trim().toUpperCase()
  return n.includes("MOMO") || n.includes("AIRTEL")
}

/** Prefer the checkout input; never read a pasted payment SMS. */
export function resolveGrandmaPayerPhone(
  accountPhone: string | null | undefined,
  inputPhone: string,
): string {
  const fromInput = normalizeRwMobileMoneyPhone(inputPhone)
  if (isValidRwMobileMoneyPhone(fromInput)) return fromInput
  const fromAccount = normalizeRwMobileMoneyPhone(accountPhone ?? "")
  if (isValidRwMobileMoneyPhone(fromAccount)) return fromAccount
  return normalizePhoneDigitsForAuth((inputPhone || accountPhone || "").trim())
}

export type GrandmaMomoPhoneGuardOk = {
  ok: true
  phoneRegisteredOnOrder: string
  buyerPhone: string
}

export type GrandmaMomoPhoneGuardFail = {
  ok: false
  code: "MISSING_PHONE" | "INVALID_PHONE" | "MISSING_PHONE_REGISTERED_ON_ORDER"
  submit: false
}

export type GrandmaMomoPhoneGuardResult = GrandmaMomoPhoneGuardOk | GrandmaMomoPhoneGuardFail

/**
 * SMS body is accepted only so callers can prove it is ignored.
 * Do not parse merchant/recipient digits from it.
 */
export function guardGrandmaMobileMoneyPhone(args: {
  paymentId: GrandmaCheckoutPaymentId | string
  accountPhone?: string | null
  inputPhone: string
  smsBody?: string
}): GrandmaMomoPhoneGuardResult {
  void args.smsBody
  const resolved = resolveGrandmaPayerPhone(args.accountPhone, args.inputPhone)
  if (!isGrandmaMobileMoneyPayment(String(args.paymentId))) {
    return { ok: true, phoneRegisteredOnOrder: "", buyerPhone: resolved }
  }
  if (!resolved) {
    return { ok: false, code: "MISSING_PHONE", submit: false }
  }
  if (!isValidRwMobileMoneyPhone(resolved)) {
    return { ok: false, code: "INVALID_PHONE", submit: false }
  }
  return { ok: true, phoneRegisteredOnOrder: resolved, buyerPhone: resolved }
}

/** Last-line guard before fetch — MoMo/Airtel must carry phoneRegisteredOnOrder. */
export function assertGrandmaOrderPayloadHasMomoPhone(payload: {
  paymentName: string
  phoneRegisteredOnOrder?: string | null
}): { ok: true } | GrandmaMomoPhoneGuardFail {
  if (!isGrandmaMobileMoneyPaymentName(payload.paymentName)) return { ok: true }
  const phone = String(payload.phoneRegisteredOnOrder ?? "").trim()
  if (!phone) {
    return { ok: false, code: "MISSING_PHONE_REGISTERED_ON_ORDER", submit: false }
  }
  if (!isValidRwMobileMoneyPhone(normalizeRwMobileMoneyPhone(phone))) {
    return { ok: false, code: "INVALID_PHONE", submit: false }
  }
  return { ok: true }
}

export function logGrandmaMomoPhoneGuardFailure(code: string, normalizedOrEmpty: string): void {
  const tail = normalizedOrEmpty ? maskPhoneForDisplay(normalizedOrEmpty) : "(empty)"
  console.error(`[grandma-checkout] refusing MoMo/Airtel order: ${code}; phone=${tail}`)
}

export function grandmaCourierDisplayState(poolLength: number): {
  hasAssignableCouriers: boolean
  showFakeAssignedCourier: false
} {
  return {
    hasAssignableCouriers: poolLength > 0,
    showFakeAssignedCourier: false,
  }
}

export type GrandmaCheckoutLockReason = "stock" | "sms" | "phone" | "cash" | "none"

/** Why Send Order is blocked. Phone is separate from SMS match. */
export function grandmaCheckoutSendLockReason(args: {
  hasStockBlock: boolean
  paymentId: string
  smsPaymentReady: boolean
  payerPhoneOk: boolean
  cashConfirm: boolean
}): GrandmaCheckoutLockReason {
  if (args.hasStockBlock) return "stock"
  const pay = args.paymentId.trim().toLowerCase()
  if (pay === "momo" || pay === "airtel") {
    if (!args.smsPaymentReady) return "sms"
    if (!args.payerPhoneOk) return "phone"
    return "none"
  }
  if (pay === "cash") return args.cashConfirm ? "none" : "cash"
  if (pay === "bk") return args.payerPhoneOk ? "none" : "phone"
  return "sms"
}

export function isGrandmaMobileMoneyPhoneRequiredError(raw: string): boolean {
  const low = raw.toLowerCase()
  return low.includes("phone number used for mobile money") || low.includes("phoneregisteredonorder")
}

/** Next → Java OrdersServlet createOrder body (phone fields included). */
export function attachPhoneRegisteredOnOrder<T extends Record<string, unknown>>(
  payload: T,
  phoneRegisteredOnOrder: string,
): T & { phoneRegisteredOnOrder: string; PHONE_REGISTERED_ON_ORDER: string } {
  const phone = String(phoneRegisteredOnOrder ?? "").trim()
  return {
    ...payload,
    phoneRegisteredOnOrder: phone,
    PHONE_REGISTERED_ON_ORDER: phone,
  }
}
