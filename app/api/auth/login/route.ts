import { NextResponse } from "next/server"

const JAVA_AUTH_URL = process.env.JAVA_AUTH_URL || ""
// Disable verbose logging to avoid exposing sensitive info
const isAuthDebugEnabled = false

const debugLog = (...args: any[]) => {
  if (isAuthDebugEnabled) {
    console.log(...args)
  }
}

const debugError = (...args: any[]) => {
  if (isAuthDebugEnabled) {
    console.error(...args)
  }
}

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    debugLog(`[RID ${rid}] /api/auth/login START`)
    debugLog(`[RID ${rid}] JAVA_AUTH_URL=${JAVA_AUTH_URL}`)

    const { email, password } = await req.json()
    // Only log non-sensitive metadata in development
    debugLog(`[RID ${rid}] Received login request (email length=${String(email || "").length}, passwordLength=${password?.length || 0})`)

    if (!JAVA_AUTH_URL) {
      debugError(`[RID ${rid}] FATAL: Missing JAVA_AUTH_URL environment variable`)
      return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "login")
    form.set("email", String(email || ""))
    form.set("password", String(password || ""))

    debugLog(`[RID ${rid}] -> Calling Java server at ${JAVA_AUTH_URL}`)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    debugLog(`[RID ${rid}] <- Java server responded with HTTP ${res.status}`)

    const text = await res.text()

    let json: any
    try {
      json = JSON.parse(text)
      debugLog(`[RID ${rid}] Parsed JSON response from auth server`)
    } catch (parseError) {
      debugError(`[RID ${rid}] Failed to parse JSON response from auth server`)
      if (isAuthDebugEnabled) {
        debugError(`[RID ${rid}] Parse error:`, parseError)
        debugError(`[RID ${rid}] Raw response (first 800 chars): ${text.slice(0, 800)}`)
      }
      return NextResponse.json(
        { ok: false, error: "Bad JSON from auth server", rid },
        { status: 502 },
      )
    }

    if (!res.ok) {
      debugError(`[RID ${rid}] HTTP error from Java: ${res.status}`)
      if (isAuthDebugEnabled) {
        debugError(`[RID ${rid}] Response payload:`, json)
      }
      return NextResponse.json({ ok: false, error: json?.error || `Auth failed (${res.status})`, rid }, { status: 401 })
    }

    if (!json?.ok) {
      debugError(`[RID ${rid}] Login failed: ${json?.error}`)
      return NextResponse.json({ ok: false, error: json?.error || "Login failed", rid }, { status: 401 })
    }

    debugLog(`[RID ${rid}] SUCCESS: Login OK`)
    return NextResponse.json({ ...json, rid })
  } catch (e: any) {
    debugError(`[RID ${rid}] EXCEPTION in login route:`)
    if (isAuthDebugEnabled) {
      debugError(`[RID ${rid}] Error type: ${e?.constructor?.name}`)
      debugError(`[RID ${rid}] Error message: ${e?.message}`)
      debugError(`[RID ${rid}] Error stack:`, e?.stack)
    }
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error", rid }, { status: 400 })
  } finally {
    const ms = Date.now() - t0
    debugLog(`[RID ${rid}] /api/auth/login DONE (${ms}ms)`)
  }
}