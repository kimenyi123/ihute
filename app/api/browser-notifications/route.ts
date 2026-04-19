import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BACKEND_BASE = getServerProxyBackendBase()

/**
 * GET /api/browser-notifications
 * Get immediate browser notifications for both anonymous and registered users
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const buyerEmail = searchParams.get("buyerEmail")

        if (!buyerEmail) {
            return NextResponse.json(
                { ok: false, error: "buyerEmail is required" },
                { status: 400 }
            )
        }

        // Query the Java backend RatingServlet for browser notifications
        const response = await fetch(`${JAVA_BACKEND_BASE}/Kaos/RatingServlet?action=getBrowserNotifications&buyerEmail=${encodeURIComponent(buyerEmail)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        })

        if (!response.ok) {
            console.error(`[BROWSER-NOTIFICATIONS-API] Backend error: ${response.status}`)
            return NextResponse.json(
                { ok: false, error: "Backend service unavailable" },
                { status: 503 }
            )
        }

        const data = await response.json()
        console.log(`[BROWSER-NOTIFICATIONS-API] Retrieved ${data.notifications?.length || 0} browser notifications for ${buyerEmail}`)

        return NextResponse.json(data)

    } catch (error: any) {
        console.error("[BROWSER-NOTIFICATIONS-API] Error:", error)
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to fetch browser notifications" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/browser-notifications
 * Trigger browser notification for a delivered order
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { orderId } = body

        if (!orderId) {
            return NextResponse.json(
                { ok: false, error: "orderId is required" },
                { status: 400 }
            )
        }

        // Call the Java backend RatingServlet to trigger browser notification
        const response = await fetch(`${JAVA_BACKEND_BASE}/Kaos/RatingServlet?action=triggerBrowserNotification&orderId=${orderId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.ok ? 200 : 500 })

    } catch (error: any) {
        console.error("[BROWSER-NOTIFICATIONS-API] POST Error:", error)
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to trigger browser notification" },
            { status: 500 }
        )
    }
}