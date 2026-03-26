/**
 * Buyer/seller lists expose financing state on **PAYMENT_STATUS** (e.g. UMUSADA after
 * invoice submit — see request-loan-with-details). Check this first.
 */
export function isPaymentStatusFinanced(paymentStatus?: string | null): boolean {
  const ps = (paymentStatus ?? "").toUpperCase().trim()
  return ps.includes("UMUSADA") || ps.includes("FINANC")
}

/** True when invoice is already financed / sent to UMUSADA (backend **PAYMENT_STATUS** only). */
export function isInvoiceFinanced(paymentStatus?: string | null): boolean {
  return isPaymentStatusFinanced(paymentStatus)
}

export function canRequestInvoiceFinancing(orderStatus?: string | null, financed?: boolean): boolean {
  if (financed) return false
  const os = (orderStatus ?? "").trim().toUpperCase()
  return os === "OPEN"
}
