import { NextResponse } from "next/server"
const JAVA_DELIVERY_URL = process.env.JAVA_DELIVERY_URL || "http://localhost:8080/Trading/DeliveryServlet" // e.g. https://your-java-host/Kaos/delivery

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json()
    if (!JAVA_DELIVERY_URL) return NextResponse.json({ ok:true, mocked:true })
    const p = new URLSearchParams()
    p.set("action", "markReceived")
    p.set("orderId", String(orderId || ""))

    const res = await fetch(JAVA_DELIVERY_URL, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: p.toString() })
    const text = await res.text()
    let json:any
    try { json = JSON.parse(text) } catch { return NextResponse.json({ ok:false, error:"Bad JSON" }, { status:502 }) }
    if (!res.ok || !json?.ok) return NextResponse.json({ ok:false, error: json?.error || `HTTP ${res.status}` }, { status:502 })
    return NextResponse.json(json)
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || "error" }, { status:400 })
  }
}
