import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getBackendBase } from "@/lib/backend-config"

/**
 * Unsubscribe from push notifications
 * 
 * DELETE /api/notification/unsubscribe
 * Body: {
 *   endpoint: string
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json(
        { ok: false, error: "endpoint is required" },
        { status: 400 }
      )
    }

    console.log("[notification/unsubscribe] Removing push subscription:", {
      endpoint: endpoint.substring(0, 50) + "...",
    })

    // Call backend NotificationServlet to remove subscription
    const backendUrl = `${getBackendBase()}/NotificationServlet`
    const params = new URLSearchParams()
    params.append("action", "unsubscribe")
    params.append("endpoint", endpoint)

    const response = await fetch(`${backendUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    let data
    const contentType = response.headers.get("content-type")

    if (contentType && contentType.includes("application/json")) {
      data = await response.json()
    } else {
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = { ok: response.ok, message: text }
      }
    }

    if (!response.ok) {
      console.error(`[notification/unsubscribe] Backend error (${response.status}):`, data)
      return NextResponse.json(
        { ok: false, error: data.error || `Backend error: ${response.status}` },
        { status: response.status }
      )
    }

    console.log("[notification/unsubscribe] Successfully removed subscription")
    return NextResponse.json({ ok: true, ...data })
  } catch (error: any) {
    console.error("[notification/unsubscribe] Error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
