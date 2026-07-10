import { NextRequest, NextResponse } from "next/server"
import { getOrdersUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Proxy server-generated invoice PDF from kaos OrdersServlet.getInvoicePdf */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
  }

  const url = new URL(getOrdersUrl())
  url.searchParams.set("action", "getInvoicePdf")
  url.searchParams.set("orderId", orderId)

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    })
    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/pdf")) {
      const buf = await res.arrayBuffer()
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=invoice-${orderId}.pdf`,
          "Cache-Control": "private, max-age=60",
        },
      })
    }
    const data = await res.json().catch(() => ({ ok: false, error: "Invoice PDF not available" }))
    return NextResponse.json(data, { status: res.status || 502 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load invoice PDF"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
