import { NextRequest, NextResponse } from "next/server";

// Use localhost as fallback for local development
const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading";
const RATING_NOTIFICATION_SERVLET_URL = `${JAVA_BACKEND_BASE}/RatingNotificationServlet`;

/**
 * GET /api/rating-notifications
 * Proxies GET requests to Java backend RatingNotificationServlet
 * Used to get pending rating notifications for a buyer
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const buyerEmail = searchParams.get("buyerEmail");

        if (!buyerEmail) {
            return NextResponse.json(
                { ok: false, error: "buyerEmail is required" },
                { status: 400 }
            );
        }

        const url = `${RATING_NOTIFICATION_SERVLET_URL}?action=getPending&buyerEmail=${encodeURIComponent(buyerEmail)}`;

        console.log(`[RATING-NOTIFICATIONS-API] GET ${url}`);

        const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        console.log(`[RATING-NOTIFICATIONS-API] Response status: ${resp.status}`);

        const data = await resp.json();
        console.log(`[RATING-NOTIFICATIONS-API] Response data:`, data);

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 });

    } catch (error: any) {
        console.error("[RATING-NOTIFICATIONS-API] GET Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to fetch rating notifications" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/rating-notifications
 * Proxies POST requests to Java backend RatingNotificationServlet
 * Used to mark notifications as processed
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log(`[RATING-NOTIFICATIONS-API] POST action: ${body.action}`);

        const resp = await fetch(RATING_NOTIFICATION_SERVLET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        console.log(`[RATING-NOTIFICATIONS-API] Response status: ${resp.status}`);

        const data = await resp.json();
        console.log(`[RATING-NOTIFICATIONS-API] Response data:`, data);

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 });

    } catch (error: any) {
        console.error("[RATING-NOTIFICATIONS-API] POST Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to process rating notification" },
            { status: 500 }
        );
    }
}