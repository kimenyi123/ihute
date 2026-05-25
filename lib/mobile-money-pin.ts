import type { MmProvider } from "@/lib/payment-session-token"
import { digitsOnly } from "@/lib/rwanda-phone"

/** MTN MoMo typically uses a 5-digit PIN in Rwanda. */
export const MTN_MOMO_PIN_LEN = 5

/** Airtel Money typically uses a 4-digit PIN. */
export const AIRTEL_MONEY_PIN_LEN = 4

export function mmPinLength(provider: MmProvider): number {
  return provider === "mtn" ? MTN_MOMO_PIN_LEN : AIRTEL_MONEY_PIN_LEN
}

export function isValidMmPinDigits(provider: MmProvider, raw: string): boolean {
  const d = digitsOnly(raw)
  return d.length === mmPinLength(provider)
}
