import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { supplierId, latitude, longitude } = body

        // Validate Rwanda range
        if (latitude < -2.9 || latitude > -1.0 || longitude < 28.8 || longitude > 30.9) {
            return NextResponse.json(
                { error: "Coordinates must be within Rwanda (lat: -2.9 to -1.0, lng: 28.8 to 30.9)" },
                { status: 400 }
            )
        }

        const backendUrl = process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading"

        const response = await fetch(`${backendUrl}/Kaos/AdminGPSServlet?action=update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ supplierId, latitude, longitude }),
        })

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("GPS update error:", error)
        return NextResponse.json({ error: "Failed to update GPS coordinates" }, { status: 500 })
    }
}
