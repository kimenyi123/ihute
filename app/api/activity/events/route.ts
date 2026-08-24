import { NextRequest, NextResponse } from "next/server"
import { sanitizeActivityEvent } from "@/lib/activity-sanitize"
import { getBackendBaseForProxy, warmJavaBackendBase } from "@/lib/backend-config"
import { allowSlidingWindow, getClientIp } from "@/lib/ip-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RATE_LIMIT_EVENTS = 200
const RATE_LIMIT_WINDOW_MS = 60_000
const INGEST_PATH = "/Kaos/ActivityEventsServlet"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const eventsRaw = body?.events
    if (!Array.isArray(eventsRaw) || eventsRaw.length === 0) {
      return NextResponse.json({ ok: true, accepted: 0 })
    }
    if (eventsRaw.length > 20) {
      return NextResponse.json({ ok: true, accepted: 0, warning: "batch too large" })
    }

    const ip = getClientIp(req)
    if (!allowSlidingWindow(ip, eventsRaw.length, RATE_LIMIT_EVENTS, RATE_LIMIT_WINDOW_MS)) {
      console.warn("[activity/events] rate limit exceeded ip=%s count=%d", ip, eventsRaw.length)
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 })
    }

    const docs = eventsRaw
      .map((e) => sanitizeActivityEvent(e as Record<string, unknown>))
      .filter((d): d is Record<string, unknown> => d != null)

    if (docs.length === 0) {
      return NextResponse.json({ ok: true, accepted: 0 })
    }

    await warmJavaBackendBase()
    const url = `${getBackendBaseForProxy()}${INGEST_PATH}`
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ events: docs }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })

    const contentType = resp.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean
        accepted?: number
        storage?: string
        warning?: string
      }
      return NextResponse.json({
        ok: true,
        accepted: typeof data.accepted === "number" ? data.accepted : docs.length,
        storage: data.storage || "backend",
        warning: data.warning,
      })
    }

    return NextResponse.json({ ok: true, accepted: docs.length, storage: "backend" })
  } catch (err) {
    console.error("[activity/events] proxy ingest failed:", err)
    return NextResponse.json({ ok: true, accepted: 0 })
  }
}
