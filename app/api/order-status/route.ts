import { NextRequest, NextResponse } from "next/server"

// Use localhost as fallback for local development
const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"
const ORDER_STATUS_SERVLET_URL = `${JAVA_BACKEND_BASE}/OrderStatusServlet`

/**
 * GET /api/order-status
 * Proxies GET requests to Java backend OrderStatusServlet
 * Used by the order status monitor for real-time status checking
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const orderId = searchParams.get("orderId")

        if (!orderId) {
            return NextResponse.json(
                { ok: false, error: "orderId is required" },
                { status: 400 }
            )
        }

        const url = `${ORDER_STATUS_SERVLET_URL}?orderId=${orderId}`

        console.log(`[ORDER-STATUS-API] GET ${url}`)

        const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        })

        console.log(`[ORDER-STATUS-API] Response status: ${resp.status}`)

        const data = await resp.json()
        console.log(`[ORDER-STATUS-API] Response data:`, data)

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 })

    } catch (error: any) {
        console.error("[ORDER-STATUS-API] GET Error:", error)
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to fetch order status" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/order-status
 * Proxies POST requests to Java backend OrderStatusServlet
 * Used by suppliers to update order status
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        console.log(`[ORDER-STATUS-API] POST body:`, body)

        const resp = await fetch(ORDER_STATUS_SERVLET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        })

        console.log(`[ORDER-STATUS-API] Response status: ${resp.status}`)

        const data = await resp.json()
        console.log(`[ORDER-STATUS-API] Response data:`, data)

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 })

    } catch (error: any) {
        console.error("[ORDER-STATUS-API] POST Error:", error)
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to update order status" },
            { status: 500 }
        )
    }
}