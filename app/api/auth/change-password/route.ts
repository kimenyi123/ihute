import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"
import { getJavaSetCookieValues, rewriteForwardedSetCookie } from "@/lib/java-proxy-cookies"
import { getStrongPasswordError } from "@/lib/password-policy"

const JAVA_AUTH_URL = getAuthUrl()

/**
 * Proxies to Java UserAuthServlet action=change_password (session cookie required).
 */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  try {
    const body = await req.json()
    const currentPassword = String(body?.currentPassword ?? "")
    const newPassword = String(body?.newPassword ?? "")
    if (!currentPassword) {
      return NextResponse.json({ ok: false, error: "Current password is required", rid }, { status: 400 })
    }
    const strongErr = getStrongPasswordError(newPassword)
    if (strongErr) {
      return NextResponse.json({ ok: false, error: strongErr, rid }, { status: 400 })
    }

    if (!JAVA_AUTH_URL) {
      return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
    }

    const cookie = req.headers.get("cookie") || ""
    if (!cookie) {
      return NextResponse.json(
        { ok: false, error: "Not logged in. Sign in again and retry.", rid },
        { status: 401 },
      )
    }

    if (newPassword.trim() === currentPassword.trim()) {
      return NextResponse.json(
        { ok: false, error: "New password must be different from your current password", rid },
        { status: 400 },
      )
    }

    const form = new URLSearchParams()
    form.set("action", "change_password")
    form.set("currentPassword", currentPassword)
    form.set("newPassword", newPassword)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: form.toString(),
      cache: "no-store",
    })

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: "Bad response from auth server", rid }, { status: 502 })
    }

    if (!res.ok || !json?.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error || "Could not change password", rid },
        { status: res.status >= 400 ? res.status : 400 },
      )
    }

    const response = NextResponse.json({ ok: true, rid, message: json?.message })
    for (const raw of getJavaSetCookieValues(res.headers)) {
      response.headers.append("Set-Cookie", rewriteForwardedSetCookie(raw))
    }
    return response
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error", rid }, { status: 400 })
  }
}
