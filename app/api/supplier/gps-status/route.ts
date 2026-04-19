import { NextRequest, NextResponse } from "next/server";
import { getServerProxyBackendBase } from "@/lib/backend-config";

const JAVA_BACKEND_BASE = getServerProxyBackendBase();
const GPS_SERVLET_URL = `${JAVA_BACKEND_BASE}/Kaos/AdminGPSServlet`;

/**
 * GET /api/supplier/gps-status
 * Proxies to Java backend AdminGPSServlet
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const account = searchParams.get("account");

        if (!account) {
            return NextResponse.json(
                { error: "Missing account parameter" },
                { status: 400 }
            );
        }

        // Proxy to Java backend
        const url = `${GPS_SERVLET_URL}?action=getStatus&account=${account}`;

        console.log(`[GPS-STATUS] Fetching from: ${url}`);

        const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        console.log(`[GPS-STATUS] Response status: ${resp.status}`);

        const data = await resp.json();
        console.log(`[GPS-STATUS] Response data:`, data);

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 });

    } catch (error: any) {
        console.error("[GPS-STATUS] Error:", error);
        return NextResponse.json(
            { error: "Failed to get GPS status" },
            { status: 500 }
        );
    }
}
