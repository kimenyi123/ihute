import { NextResponse } from "next/server"
import type { GrandmaPaymentChannelId } from "@/lib/grandma-order-billing"

export const runtime = "nodejs"

const CHANNELS: GrandmaPaymentChannelId[] = ["momo", "airtel", "bk", "cash"]

function isChannel(x: string): x is GrandmaPaymentChannelId {
  return (CHANNELS as string[]).includes(x)
}

/**
 * Records a payment intent id for Grandma checkout (reconciliation on the order reference).
 * Replace with Urubuto / MoMo API / BK Open Banking when wired to a live gateway.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const channel = String(body.channel ?? "").trim()
    if (!isChannel(channel)) {
      return NextResponse.json(
        { ok: false, error: "Invalid channel (momo|airtel|bk|cash)" },
        { status: 400 }
      )
    }

    const grandTotalRwf = Math.round(Number(body.grandTotalRwf ?? 0))
    const platformFeeRwf = Math.round(Number(body.platformFeeRwf ?? 0))
    const itemsSubtotalRwf = Math.round(Number(body.itemsSubtotalRwf ?? 0))
    const logisticsRwf = Math.round(Number(body.logisticsRwf ?? 0))
    const sellerAccount = String(body.sellerAccount ?? "").trim().slice(0, 120)

    if (!Number.isFinite(grandTotalRwf) || grandTotalRwf < 0) {
      return NextResponse.json({ ok: false, error: "Invalid grandTotalRwf" }, { status: 400 })
    }

    const intentId = `pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`
    const recordedAt = new Date().toISOString()

    return NextResponse.json({
      ok: true,
      intentId,
      status: "recorded",
      recordedAt,
      channel,
      sellerAccount: sellerAccount || undefined,
      amounts: {
        buyerGrandTotalRwf: grandTotalRwf,
        ihutePlatformFeeRwf: platformFeeRwf,
        itemsSubtotalRwf,
        logisticsRwf,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
