import { NextResponse } from "next/server"
import { verifyMmSession } from "@/lib/payment-session-token"
import { maskPhoneForDisplay } from "@/lib/mobile-money-validation"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const sessionToken = String(body.sessionToken ?? "")
    const session = verifyMmSession(sessionToken)
    if (!session || session.step !== "awaiting_confirmation") {
      return NextResponse.json({ ok: false, error: "Invalid or expired session" }, { status: 400 })
    }
    const forcedStatus = String(body.status ?? "").toUpperCase()
    const status = forcedStatus === "FAILED" ? "FAILED" : "SUCCESS"

    const transactionId = `MM_${session.provider.toUpperCase()}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const methodLabel = session.provider === "mtn" ? "MTN Mobile Money" : "Airtel Money"

    return NextResponse.json({
      ok: true,
      status,
      transactionId,
      paymentMethod: methodLabel,
      phoneMasked: maskPhoneForDisplay(session.phone),
      amountRwf: session.amount,
      provider: session.provider,
      message:
        status === "SUCCESS"
          ? "Payment confirmed on phone (demo — no funds moved)."
          : "Payment was not confirmed on phone.",
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
