import { NextResponse } from "next/server"

export const runtime = "nodejs"

const UPSTREAM = process.env.URUBUTO_PAYMENT_INITIATE_URL?.trim()

/**
 * Urubuto / card payment initiation. If `URUBUTO_PAYMENT_INITIATE_URL` is unset,
 * returns a clear JSON error so the UI does not hang on a missing upstream.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    if (UPSTREAM) {
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      const text = await upstream.text()
      let json: unknown = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        return NextResponse.json(
          { ok: false, error: "Upstream returned non-JSON", status: upstream.status },
          { status: 502 }
        )
      }
      return NextResponse.json(json, { status: upstream.status })
    }

    return NextResponse.json(
      {
        ok: false,
        status: "NOT_CONFIGURED",
        message:
          "Urubuto payment gateway URL is not configured. Set URUBUTO_PAYMENT_INITIATE_URL or use Mobile Money (MTN/Airtel) on the payment page.",
        urubuto_response: null,
      },
      { status: 503 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg, urubuto_response: null }, { status: 500 })
  }
}
