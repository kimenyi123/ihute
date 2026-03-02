// app/api/supplier/location/route.ts
import { NextRequest, NextResponse } from "next/server"

// Use localhost as fallback for local development (production sets via env var)
const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"
const LOCATION_SERVLET_URL = `${JAVA_BACKEND_BASE}/SupplierLocationServlet`

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams
        const action = searchParams.get("action") || ""
        const account = searchParams.get("account") || ""

        const url = `${LOCATION_SERVLET_URL}?action=${action}&account=${account}`

        console.log(`[SUPPLIER-LOCATION] Fetching from: ${url}`)

        const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        })

        console.log(`[SUPPLIER-LOCATION] Response status: ${resp.status}`)

        const data = await resp.json()
        console.log(`[SUPPLIER-LOCATION] Response data:`, data)

        return NextResponse.json(data, { status: resp.ok ? 200 : 500 })

    } catch (e: any) {
        console.error(`[SUPPLIER-LOCATION] Error:`, e)
        return NextResponse.json(
            { ok: false, error: e?.message || "Failed to fetch location" },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const resp = await fetch(LOCATION_SERVLET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        })

        const data = await resp.json()
        return NextResponse.json(data, { status: resp.ok ? 200 : 500 })

    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Failed to update location" },
            { status: 500 }
        )
    }
}
