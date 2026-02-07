import { NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

const JAVA_ORDERS_URL = getOrdersUrl()

export async function POST(req: Request) {
  try {
    if (!JAVA_ORDERS_URL) {
      return NextResponse.json({ ok: false, error: "JAVA_ORDERS_URL not configured" }, { status: 500 })
    }
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })

    const params = new URLSearchParams()
    params.set("action", "markReceived")
    params.set("orderId", String(orderId))

    const res = await fetch(JAVA_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      return NextResponse.json({ ok: false, error: json?.error || "Failed to mark received" }, { status: 502 })
    }
    return NextResponse.json(json) // { ok:true }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 400 })
  }
}
