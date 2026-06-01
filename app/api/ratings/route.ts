import { NextRequest, NextResponse } from "next/server";
import { getServerProxyBackendBase } from "@/lib/backend-config";

const JAVA_BACKEND_BASE = getServerProxyBackendBase();
const RATING_SERVLET_URL = `${JAVA_BACKEND_BASE}/Kaos/RatingServlet`;

/**
 * GET /api/ratings
 * Proxies GET requests to Java backend RatingServlet
 * Actions: shouldShowPopup, getSupplierRating
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const action = searchParams.get("action") || "";
        const orderId = searchParams.get("orderId") || "";
        const account = searchParams.get("account") || "";

        // Build query string
        const params = new URLSearchParams();
        if (action) params.append("action", action);
        if (orderId) params.append("orderId", orderId);
        if (account) params.append("account", account);

        const url = `${RATING_SERVLET_URL}?${params.toString()}`;

        console.log(`[RATING-API] GET ${url}`);

        const resp = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
            cache: "no-store",
        });

        console.log(`[RATING-API] Response status: ${resp.status}`);

        const contentType = resp.headers.get("content-type") || ""

        if (contentType.includes("application/json")) {
            const data = await resp.json();
            console.log(`[RATING-API] Response data:`, data);
            return NextResponse.json(data, { status: resp.ok ? 200 : 500 });
        } else {
            const text = await resp.text()
            console.warn(`[RATING-API] Expected JSON but got ${contentType}. Returning error.`)
            return NextResponse.json(
                { ok: false, error: `Upstream returned non-JSON response`, upstreamStatus: resp.status, upstreamBodySnippet: text.slice(0, 100) },
                { status: 502 }
            )
        }

    } catch (error: any) {
        console.error("[RATING-API] GET Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to fetch rating data" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/ratings
 * Proxies POST requests to Java backend RatingServlet
 * Actions: submitRating, trackAttempt
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log(`[RATING-API] POST action: ${body.action}`);

        const resp = await fetch(RATING_SERVLET_URL, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        console.log(`[RATING-API] Response status: ${resp.status}`);

        const contentType = resp.headers.get("content-type") || ""

        if (contentType.includes("application/json")) {
            const data = await resp.json();
            console.log(`[RATING-API] Response data:`, data);
            return NextResponse.json(data, { status: resp.ok ? 200 : 500 });
        } else {
            const text = await resp.text()
            console.warn(`[RATING-API] Expected JSON but got ${contentType}. Returning error.`)
            return NextResponse.json(
                { ok: false, error: `Upstream returned non-JSON response`, upstreamStatus: resp.status, upstreamBodySnippet: text.slice(0, 100) },
                { status: 502 }
            )
        }

    } catch (error: any) {
        console.error("[RATING-API] POST Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to submit rating" },
            { status: 500 }
        );
    }
}
