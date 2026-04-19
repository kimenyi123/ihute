import { NextRequest, NextResponse } from "next/server";
import { getServerProxyBackendBase } from "@/lib/backend-config";

const JAVA_BACKEND_BASE = getServerProxyBackendBase();
const ADMIN_RATING_SERVLET_URL = `${JAVA_BACKEND_BASE}/Kaos/AdminRatingServlet`;

export async function GET(request: NextRequest) {
    try {
        // Forward all query parameters to Java backend
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action") || "getAllRatings";

        // Build query string
        const params = new URLSearchParams();
        searchParams.forEach((value, key) => {
            params.append(key, value);
        });

        const url = `${ADMIN_RATING_SERVLET_URL}?${params.toString()}`;

        // Forward cookies for session
        const cookieHeader = request.headers.get("cookie");
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        if (cookieHeader) {
            headers["Cookie"] = cookieHeader;
        }

        const response = await fetch(url, {
            method: "GET",
            headers,
            credentials: "include",
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Admin ratings GET error:", error);
        return NextResponse.json(
            { ok: false, error: "Failed to fetch admin ratings" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Forward cookies for session
        const cookieHeader = request.headers.get("cookie");
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        if (cookieHeader) {
            headers["Cookie"] = cookieHeader;
        }

        const response = await fetch(ADMIN_RATING_SERVLET_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            credentials: "include",
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Admin ratings POST error:", error);
        return NextResponse.json(
            { ok: false, error: "Failed to process admin rating action" },
            { status: 500 }
        );
    }
}
