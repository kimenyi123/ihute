import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getBackendBase } from "@/lib/backend-config"

/**
 * Subscribe to push notifications
 * 
 * POST /api/notification/subscribe
 * Body: {
 *   endpoint: string,
 *   keys: {
 *     p256dh: string,
 *     auth: string
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log("[notification/subscribe] Received body:", JSON.stringify(body, null, 2))
    
    const { endpoint, keys, userId, userEmail } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      console.error("[notification/subscribe] Missing required fields:", {
        hasEndpoint: !!endpoint,
        hasKeys: !!keys,
        hasP256dh: !!keys?.p256dh,
        hasAuth: !!keys?.auth,
      })
      return NextResponse.json(
        { ok: false, error: "endpoint and keys (p256dh, auth) are required" },
        { status: 400 }
      )
    }

    console.log("[notification/subscribe] Registering push subscription:", {
      endpoint: endpoint.substring(0, 50) + "...",
      hasP256dh: !!keys.p256dh,
      hasAuth: !!keys.auth,
      userId: userId || "not provided",
      userEmail: userEmail || "not provided",
    })

    // Call backend NotificationServlet to store subscription
    const backendUrl = `${getBackendBase()}/NotificationServlet`
    const params = new URLSearchParams()
    params.append("action", "subscribe")
    params.append("endpoint", endpoint)
    params.append("p256dh", keys.p256dh)
    params.append("auth", keys.auth)
    
    // Add user identification - use userId if provided, otherwise generate sessionId
    if (userId) {
      params.append("userId", userId)
    } else if (userEmail) {
      params.append("userId", userEmail)
    } else {
      // Generate a session ID for anonymous users
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      params.append("sessionId", sessionId)
      console.log("[notification/subscribe] Generated sessionId for anonymous user:", sessionId)
    }

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
      console.error(`[notification/subscribe] Backend error (${response.status}):`, data)
      return NextResponse.json(
        { ok: false, error: data.error || `Backend error: ${response.status}` },
        { status: response.status }
      )
    }

    console.log("[notification/subscribe] Successfully registered subscription")
    return NextResponse.json({ ok: true, ...data })
  } catch (error: any) {
    console.error("[notification/subscribe] Error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
