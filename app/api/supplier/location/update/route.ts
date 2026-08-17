import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BACKEND_BASE = getServerProxyBackendBase()
const UPDATE_SERVLET_URL = `${JAVA_BACKEND_BASE}/SupplierLocationUpdateServlet`

export async function POST(req: NextRequest) {
    try {
        // Get all cookies from the incoming request
        const cookieHeader = req.headers.get('cookie') || ''

        // Check content length to avoid parsing empty body
        const contentLength = req.headers.get('content-length')
        if (!contentLength || parseInt(contentLength) === 0) {
            console.error('[GPS-UPDATE] Empty request body - client not sending GPS data')
            return NextResponse.json(
                { ok: false, error: 'EMPTY_BODY', message: 'No GPS data provided' },
                { status: 400 }
            )
        }

        // Get the JSON body
        const body = await req.json()

        console.log(`[GPS-UPDATE] Sending location update to: ${UPDATE_SERVLET_URL}`)
        console.log(`[GPS-UPDATE DEBUG] Cookie header:`, cookieHeader ? 'Present' : 'MISSING!')
        console.log(`[GPS-UPDATE DEBUG] Has JSESSIONID:`, cookieHeader.includes('JSESSIONID'))


        // Forward to Java servlet with session cookies
        const resp = await fetch(UPDATE_SERVLET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookieHeader,  // Forward session cookies (JSESSIONID)
            },
            body: JSON.stringify(body),
        })

        const data = await resp.json()

        console.log(`[GPS-UPDATE] Response status: ${resp.status}`, data)

        return NextResponse.json(data, { status: resp.status })

    } catch (e: any) {
        console.error(`[GPS-UPDATE] Error:`, e)
        return NextResponse.json(
            { ok: false, error: "PROXY_ERROR", message: e?.message || "Failed to update location" },
            { status: 500 }
        )
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    })
}
