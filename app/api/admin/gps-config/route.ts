// Admin GPS Configuration API
// Handles GPS config CRUD and seller overrides
import { NextRequest, NextResponse } from "next/server"

// Use localhost as fallback for local development (production sets via env var)
const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"
const GPS_CONFIG_SERVLET = `${JAVA_BACKEND_BASE}/AdminGPSConfigServlet`

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams
        const action = searchParams.get("action") || "getConfig"
        const sellerId = searchParams.get("sellerId") || ""

        const cookies = req.headers.get('cookie') || '';

        const url = `${GPS_CONFIG_SERVLET}?action=${action}${sellerId ? `&sellerId=${sellerId}` : ''}`;

        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'Cookie': cookies,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            cache: 'no-store'
        });

        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });

    } catch (error: any) {
        console.error('[ADMIN-GPS-CONFIG] GET Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const cookies = req.headers.get('cookie') || '';

        const resp = await fetch(GPS_CONFIG_SERVLET, {
            method: 'POST',
            headers: {
                'Cookie': cookies,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body),
            cache: 'no-store'
        });

        const data = await resp.json();
        return NextResponse.json(data, { status: resp.status });

    } catch (error: any) {
        console.error('[ADMIN-GPS-CONFIG] POST Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
