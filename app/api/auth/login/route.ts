import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"

const JAVA_AUTH_URL = getAuthUrl()

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    console.log(`[RID ${rid}] /api/auth/login START`)
    console.log(`[RID ${rid}] JAVA_AUTH_URL=${JAVA_AUTH_URL}`)

    const { email, password } = await req.json()
    console.log(`[RID ${rid}] Received: email=${email}, passwordLength=${password?.length || 0}`)

    if (!JAVA_AUTH_URL) {
      console.error(`[RID ${rid}] FATAL: Missing JAVA_AUTH_URL environment variable`)
      return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "login")
    form.set("email", String(email || ""))
    form.set("password", String(password || ""))

    console.log(`[RID ${rid}] -> Calling Java server at ${JAVA_AUTH_URL}`)
    console.log(`[RID ${rid}] Form data: action=login, email=${email}, passwordLength=${password?.length || 0}`)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    console.log(`[RID ${rid}] <- Java server responded with HTTP ${res.status}`)
    console.log(`[RID ${rid}] Response headers: ${JSON.stringify(Object.fromEntries(res.headers))}`)

    const text = await res.text()
    console.log(`[RID ${rid}] Response body (first 500 chars): ${text.slice(0, 500)}`)

    let json: any
    try {
      json = JSON.parse(text)
      console.log(`[RID ${rid}] Parsed JSON:`, json)
    } catch (parseError) {
      console.error(`[RID ${rid}] FATAL: Failed to parse JSON response`)
      console.error(`[RID ${rid}] Parse error:`, parseError)
      console.error(`[RID ${rid}] Raw response (800 chars): ${text.slice(0, 800)}`)
      return NextResponse.json(
        { ok: false, error: "Bad JSON from auth server", raw: text.slice(0, 800), rid },
        { status: 502 },
      )
    }

    if (!res.ok) {
      console.warn(`[RID ${rid}] HTTP error from Java: ${res.status}`)
      console.warn(`[RID ${rid}] Response payload:`, json)
      return NextResponse.json({ ok: false, error: json?.error || `Auth failed (${res.status})`, rid }, { status: 401 })
    }

    if (!json?.ok) {
      console.warn(`[RID ${rid}] Login failed: ${json?.error}`)
      return NextResponse.json({ ok: false, error: json?.error || "Login failed", rid }, { status: 401 })
    }

    console.log(`[RID ${rid}] SUCCESS: Login OK`)
    return NextResponse.json({ ...json, rid })
  } catch (e: any) {
    console.error(`[RID ${rid}] EXCEPTION in login route:`)
    console.error(`[RID ${rid}] Error type: ${e?.constructor?.name}`)
    console.error(`[RID ${rid}] Error message: ${e?.message}`)
    console.error(`[RID ${rid}] Error stack:`, e?.stack)
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error", rid }, { status: 400 })
  } finally {
    const ms = Date.now() - t0
    console.log(`[RID ${rid}] /api/auth/login DONE (${ms}ms)`)
  }
}