import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const UPSTREAM = process.env.URUBUTO_PAYMENT_VERIFY_URL?.trim()

export async function GET(req: NextRequest) {
  try {
    const transactionId = req.nextUrl.searchParams.get("transaction_id")?.trim()
    if (!transactionId) {
      return NextResponse.json({ ok: false, error: "transaction_id required" }, { status: 400 })
    }

    if (UPSTREAM) {
      const url = new URL(UPSTREAM)
      url.searchParams.set("transaction_id", transactionId)
      const merchant = req.nextUrl.searchParams.get("merchant_code")
      if (merchant) url.searchParams.set("merchant_code", merchant)
      const upstream = await fetch(url.toString(), { cache: "no-store" })
      const text = await upstream.text()
      try {
        const json = text ? JSON.parse(text) : {}
        return NextResponse.json(json, { status: upstream.status })
      } catch {
        return NextResponse.json({ ok: false, error: "Upstream non-JSON" }, { status: 502 })
      }
    }

    return NextResponse.json(
      {
        status: "UNKNOWN",
        message: "Verification gateway not configured (URUBUTO_PAYMENT_VERIFY_URL).",
        transaction_id: transactionId,
        urubuto_response: null,
      },
      { status: 503 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg, urubuto_response: null }, { status: 500 })
  }
}
