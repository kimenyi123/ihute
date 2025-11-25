import { NextResponse } from "next/server"

const JAVA_ORDERS_SERVLET_URL =
  process.env.JAVA_ORDERS_URL ||
  process.env.JAVA_SERVLET_URL ||
  "https://ihute.rw/Trading/Kaos/OrdersServlet"

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Method not allowed. Please use POST to submit supplier service ratings.",
      hint: "Navigate to /supplier-services/rate with query params instead of calling this API directly"
    },
    { status: 405 }
  )
}

export async function POST(req: Request) {
  try {
    const { supplierId, orderId, deliveryRating, communicationRating, feedback, email } = await req.json()
    
    if (!supplierId || !email || !deliveryRating || !communicationRating) {
      return NextResponse.json(
        { ok: false, error: "supplierId, email, deliveryRating, and communicationRating are required" }, 
        { status: 400 }
      )
    }

    if (!JAVA_ORDERS_SERVLET_URL) {
      // Mock response for development
      return NextResponse.json({ 
        ok: true, 
        mocked: true,
        message: "Supplier service rating saved (mocked)" 
      })
    }

    const params = new URLSearchParams()
    params.set("action", "rateSupplierService")
    params.set("supplierId", String(supplierId))
    params.set("email", String(email))
    params.set("deliveryRating", String(deliveryRating))
    params.set("communicationRating", String(communicationRating))
    if (orderId) params.set("orderId", String(orderId))
    if (feedback) params.set("feedback", String(feedback))

    const res = await fetch(JAVA_ORDERS_SERVLET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    const text = await res.text()
    let json: any
    try { 
      json = JSON.parse(text) 
    } catch { 
      return NextResponse.json({ ok: false, error: "Bad JSON response" }, { status: 502 }) 
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error || `HTTP ${res.status}` }, 
        { status: 502 }
      )
    }

    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 })
  }
}

