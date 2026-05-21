import { buildMoMoUssd } from "@/lib/momo-ussd"
import { digitsOnly } from "@/lib/rwanda-phone"

export const IHUTE_PLATFORM_FEE_RATE = 0.01 as const

export type GrandmaPaymentChannelId = "momo" | "airtel" | "bk" | "cash"

export function computeIhutePlatformFeeRwf(itemsSubtotalRwf: number): number {
  return Math.round(Math.max(0, itemsSubtotalRwf) * IHUTE_PLATFORM_FEE_RATE)
}

/** Strip common labels from shop payout line for display / USSD. */
export function stripShopMomoLabel(raw: string): string {
  return String(raw ?? "")
    .replace(/^MTN\s*MoMo:\s*/i, "")
    .replace(/^Airtel\s*Money:\s*/i, "")
    .replace(/^Airtel:\s*/i, "")
    .trim()
}

/**
 * Merchant receive code for MTN USSD — digits only, last chunk if long GSM number embedded.
 */
export function extractMerchantMomoCodeForUssd(shopMomoField: string): string {
  const d = digitsOnly(shopMomoField)
  if (!d) return ""
  if (d.length <= 10) return d
  return d.slice(-10)
}

export function buildGrandmaMtnUssd(shopMomoField: string, amountRwf: number): string {
  const code = extractMerchantMomoCodeForUssd(shopMomoField)
  if (!code || amountRwf < 1) return ""
  return buildMoMoUssd(code, amountRwf)
}

/**
 * Grep-friendly tail appended to Kaos `REFERENCE` so ops / reports can read platform fee & payment intent.
 * ASCII only; no raw spaces in values.
 */
export function buildGrandmaBillingReferenceTail(args: {
  intentId: string
  ihuteFeeRwf: number
  itemsSubtotalRwf: number
  logisticsRwf: number
  buyerGrandTotalRwf: number
  paymentChannel: GrandmaPaymentChannelId
  payerDigits?: string
  /** @deprecated use bkCardLast4 for BK card demo */
  bkRef?: string
  /** Last 4 of card only — never full PAN */
  bkCardLast4?: string
}): string {
  const safeBk = (args.bkRef ?? "")
    .replace(/[^\w\-./]/g, "")
    .slice(0, 40)
  const card4 = (args.bkCardLast4 ?? "").replace(/\D/g, "").slice(-4)
  const payer = (args.payerDigits ?? "").replace(/\D/g, "").slice(0, 15)
  const segs = [
    `PI=${args.intentId}`,
    `FEE=${args.ihuteFeeRwf}`,
    `SUB=${args.itemsSubtotalRwf}`,
    `LOG=${args.logisticsRwf}`,
    `PAY=${args.buyerGrandTotalRwf}`,
    `CH=${args.paymentChannel}`,
  ]
  if (payer) segs.push(`PAYER=${payer}`)
  if (safeBk) segs.push(`BKREF=${safeBk}`)
  if (card4.length === 4) segs.push(`CARD4=${card4}`)
  return ` |IHUTE:${segs.join(":")}|`
}
