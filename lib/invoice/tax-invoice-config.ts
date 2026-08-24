/** Tax invoice presentation config — no hardcoded business data. */

export function getTaxInvoiceAppName(): string {
  return (
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_SITE_NAME?.trim() ||
    "iHute"
  )
}

export function getTaxInvoiceVatRateB(): number {
  const raw = process.env.NEXT_PUBLIC_EBM_VAT_RATE_B?.trim()
  const n = raw ? Number(raw) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : 14
}
