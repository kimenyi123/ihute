import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

export async function GET(req: NextRequest) {
    try {
        const backendUrl = getServerProxyBackendBase()
        const cookies = req.headers.get('cookie') || '';

        const response = await fetch(`${backendUrl}/GPSStatsServlet`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookies
            },
            credentials: 'include',
            cache: 'no-store'
        })

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("GPS stats error:", error)
        return NextResponse.json({ error: "Failed to fetch GPS stats" }, { status: 500 })
    }
}
