import { NextRequest, NextResponse } from "next/server"
import {
  getBackendBaseForProxy,
  getProxyTimeoutMs,
  isTomcatMissingServlet,
  warmJavaBackendBase,
} from "@/lib/backend-config"

const EMPTY = { ok: true as const, notifications: [] as unknown[], count: 0 }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated", notifications: [], count: 0 },
        { status: 401 },
      )
    }

    await warmJavaBackendBase()
    const backendUrl = getBackendBaseForProxy()
    const timeoutMs = Math.min(8000, Math.max(4000, getProxyTimeoutMs()))

    let response: Response
    try {
      response = await fetch(
        `${backendUrl}/NotificationServlet?action=getUnread&userId=${encodeURIComponent(userId)}`,
        { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) },
      )
    } catch (e) {
      console.warn("[notifications/unread] backend unreachable:", e)
      return NextResponse.json({ ...EMPTY, degraded: true })
    }

    const text = await response.text()
    const contentType = response.headers.get("content-type") || ""

    if (isTomcatMissingServlet(text, response.status)) {
      return NextResponse.json({ ...EMPTY, degraded: true })
    }

    const isJson = contentType.includes("application/json") && response.ok
    if (!isJson || text.trim().startsWith("<")) {
      return NextResponse.json(EMPTY)
    }

    try {
      const data = JSON.parse(text) as {
        ok?: boolean
        notifications?: unknown[]
        count?: number
      }
      return NextResponse.json({
        ok: data.ok ?? true,
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        count: typeof data.count === "number" ? data.count : 0,
      })
    } catch {
      return NextResponse.json(EMPTY)
    }
  } catch (error) {
    console.error("[notifications/unread]", error)
    return NextResponse.json({ ...EMPTY, degraded: true })
  }
}
