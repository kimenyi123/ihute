// app/api/delivery/list/route.ts
import { NextResponse } from "next/server"
import { getDeliveryUrl } from "@/lib/backend-config"

const JAVA_DELIVERY_URL = getDeliveryUrl()

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    // Mock response if backend not configured
    if (!JAVA_DELIVERY_URL || JAVA_DELIVERY_URL.includes("localhost")) {
      console.log("[Delivery List] No backend configured, returning mock data")
      return NextResponse.json({ ok: true, rows: [] })
    }

    const p = new URLSearchParams()
    p.set("action", "listByBuyer")
    p.set("email", String(email || ""))

    const res = await fetch(JAVA_DELIVERY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p.toString()
    })

    const text = await res.text()
    let json: any

    try {
      json = JSON.parse(text)
    } catch {
      console.error("[Delivery List] Backend returned HTML instead of JSON:", text.substring(0, 200))
      return NextResponse.json({
        ok: false,
        error: "Backend is not properly configured. Expected JSON but received HTML."
      }, { status: 502 })
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json({
        ok: false,
        error: json?.error || `HTTP ${res.status}`
      }, { status: 502 })
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[Delivery List] Error:", e)
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 })
  }
}
