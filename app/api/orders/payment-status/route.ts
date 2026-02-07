import { NextResponse } from "next/server"

import { getOrdersUrl } from "@/lib/backend-config"

const JAVA_ORDERS_URL = getOrdersUrl()

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })

    const params = new URLSearchParams()
    params.set("action", "paymentStatus")
    params.set("orderId", String(orderId))

    const res = await fetch(JAVA_ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    })
    const json = await res.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 502 })
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown error" }, { status: 500 })
  }
}
