import { NextResponse } from "next/server"
import { signMmSession } from "@/lib/payment-session-token"
import {
  isValidRwMobileMoneyPhone,
  maskPhoneForDisplay,
  normalizeRwMobileMoneyPhone,
  validatePositiveAmountRwf,
} from "@/lib/mobile-money-validation"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const provider = String(body.provider ?? "").toLowerCase()
    if (provider !== "mtn" && provider !== "airtel") {
      return NextResponse.json({ ok: false, error: "provider must be mtn or airtel" }, { status: 400 })
    }
    const phone = normalizeRwMobileMoneyPhone(String(body.phone ?? ""))
    if (!isValidRwMobileMoneyPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Enter a valid Rwanda mobile number" }, { status: 400 })
    }
    const amount = Number(body.amount)
    if (!validatePositiveAmountRwf(amount)) {
      return NextResponse.json(
        { ok: false, error: "Amount must be between 100 and 50,000,000 RWF" },
        { status: 400 }
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const sessionToken = signMmSession({
      v: 1,
      step: "awaiting_confirmation",
      provider: provider as "mtn" | "airtel",
      phone,
      amount: Math.round(amount),
      iat: now,
      exp: now + 600,
    })

    return NextResponse.json({
      ok: true,
      sessionToken,
      maskedPhone: maskPhoneForDisplay(phone),
      message: "Payment request sent. Confirm on your phone to complete.",
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
