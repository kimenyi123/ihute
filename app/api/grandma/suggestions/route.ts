import { NextRequest, NextResponse } from "next/server"
import {
  friendlySuggestionDbError,
  insertClientSuggestion,
  validateClientSuggestionInput,
} from "@/lib/client-suggestion"
import { allowSlidingWindow, getClientIp } from "@/lib/ip-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SUGGESTION_RATE_LIMIT = 8
const SUGGESTION_RATE_WINDOW_MS = 10 * 60_000

/** Public Grandma support form — persists to client_suggestion via ONBOARDING_MYSQL_*. */
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID()
  try {
    const ip = getClientIp(req)
    if (!allowSlidingWindow(`grandma-suggestion:${ip}`, 1, SUGGESTION_RATE_LIMIT, SUGGESTION_RATE_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "Please wait a moment before submitting again.", rid },
        { status: 429 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request.", rid }, { status: 400 })
    }
    const parsed = validateClientSuggestionInput(body)
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, field: parsed.field, rid },
        { status: 400 },
      )
    }
    const { id } = await insertClientSuggestion(parsed.value)
    return NextResponse.json({ ok: true, id, rid })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[api/grandma/suggestions] ${rid}`, msg)
    const friendly = friendlySuggestionDbError(msg)
    const status = msg === "MYSQL_NOT_CONFIGURED" ? 503 : 500
    return NextResponse.json({ ok: false, error: friendly, rid }, { status })
  }
}
