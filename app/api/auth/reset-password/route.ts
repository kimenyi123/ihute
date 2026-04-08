import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"

const JAVA_AUTH_URL = getAuthUrl()

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json()
    const tokenStr = String(token ?? "").trim()
    const passwordStr = String(newPassword ?? "")

    if (!tokenStr || !passwordStr) {
      return NextResponse.json({ ok: false, error: "Token and new password are required" }, { status: 400 })
    }

    if (passwordStr.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      )
    }

    if (!JAVA_AUTH_URL) {
      return NextResponse.json({ ok: false, error: "Auth backend not configured" }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "reset_password")
    form.set("token", tokenStr)
    form.set("newPassword", passwordStr)

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

    if (!res.ok || !json?.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error || "Could not reset password" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: json?.message || "Password updated. You can sign in with your new password.",
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 400 })
  }
}
