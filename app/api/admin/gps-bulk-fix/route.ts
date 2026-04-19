import { NextRequest, NextResponse } from "next/server"
import { getServerProxyBackendBase } from "@/lib/backend-config"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, selectedIds } = body

        const backendUrl = getServerProxyBackendBase()

        const response = await fetch(`${backendUrl}/Kaos/AdminGPSServlet?action=bulkFix&type=${action}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ selectedIds: selectedIds || [] }),
        })

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("GPS bulk fix error:", error)
        return NextResponse.json({ error: "Failed to execute bulk fix" }, { status: 500 })
    }
}
