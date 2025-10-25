// app/api/delivery/list/route.ts
import { NextResponse } from "next/server"
const JAVA_DELIVERY_URL = process.env.JAVA_DELIVERY_URL || "http://localhost:8080/Trading/DeliveryServlet" // e.g. https://your-java-host/Kaos/delivery

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!JAVA_DELIVERY_URL) return NextResponse.json({ ok:true, rows:[] })
    const p = new URLSearchParams()
    p.set("action", "listByBuyer")
    p.set("email", String(email || ""))

    const res = await fetch(JAVA_DELIVERY_URL, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: p.toString() })
    const json = await res.json()
    if (!res.ok || !json?.ok) return NextResponse.json({ ok:false, error: json?.error || `HTTP ${res.status}` }, { status:502 })
    return NextResponse.json(json)
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message || "error" }, { status:400 })
  }
}
