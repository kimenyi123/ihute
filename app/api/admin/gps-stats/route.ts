import { NextResponse } from "next/server"

export async function GET() {
    try {
        const backendUrl = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"

        const response = await fetch(`${backendUrl}/Kaos/AdminGPSServlet?action=stats`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
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
