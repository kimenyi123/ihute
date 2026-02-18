import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { updates } = body

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid updates format" }, { status: 400 })
        }

        const backendUrl = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"

        const response = await fetch(`${backendUrl}/Kaos/AdminGPSServlet?action=bulkUpload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ updates }),
        })

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("GPS bulk upload error:", error)
        return NextResponse.json({ error: "Failed to upload GPS data" }, { status: 500 })
    }
}
