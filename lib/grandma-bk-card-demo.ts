import { digitsOnly } from "@/lib/rwanda-phone"

export type BkDemoFieldError = "card" | "expiry" | "cvc" | "otp"

export function getBkCardLast4(panDigits: string): string {
  const d = digitsOnly(panDigits)
  return d.length >= 4 ? d.slice(-4) : ""
}

/** Demo-only validation — not PCI; swap for tokenized gateway in production. */
export function validateGrandmaBkCardDemo(args: {
  panDigits: string
  expiry: string
  cvc: string
  otp: string
}): BkDemoFieldError | null {
  const pan = digitsOnly(args.panDigits)
  if (pan.length < 13 || pan.length > 16) return "card"

  const ex = digitsOnly(args.expiry)
  if (ex.length !== 4) return "expiry"
  const mm = Number.parseInt(ex.slice(0, 2), 10)
  const yy = Number.parseInt(ex.slice(2, 4), 10)
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) return "expiry"
  if (!Number.isFinite(yy) || yy < 0 || yy > 99) return "expiry"
  const now = new Date()
  const curYY = now.getFullYear() % 100
  const curMM = now.getMonth() + 1
  if (yy < curYY || (yy === curYY && mm < curMM)) return "expiry"

  const cvc = digitsOnly(args.cvc)
  if (cvc.length < 3 || cvc.length > 4) return "cvc"

  const otp = digitsOnly(args.otp)
  if (otp.length !== 6) return "otp"

  return null
}

export function formatBkPanGroups(panDigits: string): string {
  const d = digitsOnly(panDigits).slice(0, 16)
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim()
}
