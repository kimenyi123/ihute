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
        // Try JSON POST first (most callers send JSON)
        let resp = await fetch(RATING_SERVLET_URL, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        console.log(`[RATING-API] Response status: ${resp.status}`);

        let contentType = resp.headers.get("content-type") || ""

        // If upstream did not return JSON and this is a submitRating, retry as form-encoded
        if (!contentType.includes("application/json") && String(body.action) === "submitRating") {
            try {
                console.warn(`[RATING-API] JSON POST returned ${contentType}; retrying as form-urlencoded`)
                const form = new URLSearchParams()
                // copy known fields; fall back to stringifying complex objects
                if (body.action) form.set("action", String(body.action))
                if (body.orderId != null) form.set("orderId", String(body.orderId))
                if (body.sellerAccount) form.set("sellerAccount", String(body.sellerAccount))
                if (body.buyerPhone) form.set("buyerPhone", String(body.buyerPhone))
                if (body.supplierRating != null) form.set("supplierRating", String(body.supplierRating))
                if (body.supplierFeedback) form.set("supplierFeedback", String(body.supplierFeedback))
                if (body.itemRatings) form.set("itemRatings", JSON.stringify(body.itemRatings))
                if (body.menuItems) form.set("menuItems", JSON.stringify(body.menuItems))

                const resp2 = await fetch(RATING_SERVLET_URL, {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
                    body: form.toString(),
                    cache: "no-store",
                })

                resp = resp2
                contentType = resp.headers.get("content-type") || ""
                console.log(`[RATING-API] Retry (form) status: ${resp.status}, content-type: ${contentType}`)
            } catch (err) {
                console.error("[RATING-API] Form retry error:", err)
            }
        }

        if (contentType.includes("application/json")) {
            const data = await resp.json().catch(() => null)
            console.log(`[RATING-API] Response data:`, data);
            return NextResponse.json(data ?? { ok: false, error: "Upstream returned invalid JSON" }, { status: resp.ok ? 200 : 502 });
        } else {
            const text = await resp.text().catch(() => "")
            console.warn(`[RATING-API] Expected JSON but got ${contentType}. Returning error.`)
            return NextResponse.json(
                { ok: false, error: `Upstream returned non-JSON response`, upstreamStatus: resp.status, upstreamBodySnippet: (text || "").slice(0, 200) },
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
