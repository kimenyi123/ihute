import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"

const JAVA_AUTH_URL = getAuthUrl()

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    const emailTrimmed = String(email ?? "").trim()

    if (!emailTrimmed) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 })
    }

    if (!JAVA_AUTH_URL) {
      return NextResponse.json({ ok: false, error: "Auth backend not configured" }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "forgot_password")
    form.set("email", emailTrimmed)

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
      return NextResponse.json(
        { ok: false, error: "Bad response from auth server" },
        { status: 502 },
      )
    }

    // Java always returns ok:true for anti-enumeration
    return NextResponse.json({
      ok: json?.ok !== false,
      message: json?.message || "If an account exists for that email, you will receive reset instructions shortly.",
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 400 })
  }
}
