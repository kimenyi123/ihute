import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"

const JAVA_AUTH_URL = getAuthUrl()

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    const { email, password, firstName, lastName, tel, location, role, latitude, longitude, gpsAccuracy } = await req.json()
    if (!JAVA_AUTH_URL) {
      console.error(`[RID ${rid}] Missing JAVA_AUTH_URL`)
      return NextResponse.json({ ok: false, error: "JAVA_AUTH_URL not configured", rid }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "register")
    form.set("email", String(email || ""))
    form.set("password", String(password || ""))
    form.set("firstName", String(firstName || ""))
    form.set("lastName", String(lastName || ""))
    form.set("tel", String(tel || ""))
    form.set("location", String(location || ""))
    form.set("role", String(role || "BUYER").toUpperCase())

    // Add GPS coordinates if provided (for sellers)
    if (latitude !== null && latitude !== undefined) {
      form.set("latitude", String(latitude))
    }
    if (longitude !== null && longitude !== undefined) {
      form.set("longitude", String(longitude))
    }
    if (gpsAccuracy !== null && gpsAccuracy !== undefined) {
      form.set("gpsAccuracy", String(gpsAccuracy))
    }

    console.log(`[RID ${rid}] -> POST ${JAVA_AUTH_URL} action=register email=${email} role=${role} hasGPS=${!!latitude}`)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      console.error(`[RID ${rid}] Bad JSON from servlet. Status=${res.status} Body(800): ${text.slice(0, 800)}`)
      return NextResponse.json(
        { ok: false, error: "Bad JSON from auth server", raw: text.slice(0, 800), rid },
        { status: 502 },
      )
    }

    if (!res.ok || !json?.ok) {
      console.warn(`[RID ${rid}] Upstream register failed HTTP ${res.status} payload=${JSON.stringify(json)}`)
      return NextResponse.json({ ok: false, error: json?.error || "Register failed", rid }, { status: 400 })
    }

    return NextResponse.json({ ...json, rid })
  } catch (e: any) {
    console.error(`[RID ${rid}] Register route exception`, e)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error", rid }, { status: 400 })
  } finally {
    console.log(`[RID ${rid}] /api/auth/register done in ${Date.now() - t0}ms`)
  }
}
