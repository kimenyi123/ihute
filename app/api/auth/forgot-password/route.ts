import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"
import { resetPasswordViaMysql } from "@/lib/forgot-password-mysql"

const JAVA_AUTH_URL = getAuthUrl()

function isUnknownAction(json: { error?: string; code?: string } | null): boolean {
  const e = (json?.error ?? "").toLowerCase()
  const c = json?.code ?? ""
  return c === "AUTH_UNKNOWN_ACTION" || e.includes("unknown action")
}

type AuthJson = {
  ok?: boolean
  error?: string
  code?: string
  message?: string
  rid?: string
  warning?: boolean
}

/** Proxies to Kaos UserAuthServlet: `resetPassword` (phone + street + new password) or email forgot flow. */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  if (!JAVA_AUTH_URL) {
    return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const emailTrimmed = String(body?.email ?? "").trim()
    const tel = String(body?.tel ?? "").trim()
    const streetNumber = String(body?.streetNumber ?? "").trim()
    const newPassword = String(body?.newPassword ?? "")

    const isResetFlow = Boolean(tel && streetNumber && newPassword)

    if (isResetFlow) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { ok: false, error: "Password must be at least 6 characters", rid },
          { status: 400 }
        )
      }

      const form = new URLSearchParams()
      form.set("action", "resetPassword")
      if (emailTrimmed) form.set("email", emailTrimmed)
      form.set("tel", tel)
      form.set("streetNumber", streetNumber)
      form.set("newPassword", newPassword)

      const javaUrl = new URL(JAVA_AUTH_URL)
      javaUrl.searchParams.set("action", "resetPassword")

      const res = await fetch(javaUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        cache: "no-store",
      })

      const text = await res.text()
      let json: AuthJson
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        return NextResponse.json(
          { ok: false, error: "Bad response from auth server", raw: text.slice(0, 400), rid },
          { status: 502 }
        )
      }

      if (json?.ok === true) {
        console.log(`[api/auth/forgot-password][${rid}] Java ok in ${Date.now() - t0}ms`)
        return NextResponse.json({ ok: true, message: json.message ?? "Password updated", rid })
      }

      if (!json?.ok && isUnknownAction(json)) {
        const fb = await resetPasswordViaMysql(tel, streetNumber, newPassword)
        if (fb.ok) {
          console.log(`[api/auth/forgot-password][${rid}] MySQL fallback ok in ${Date.now() - t0}ms`)
          return NextResponse.json({ ok: true, message: "Password updated", rid, via: "mysql" })
        }
        if (fb.error !== "no_db") {
          return NextResponse.json(
            { ok: false, error: fb.error, rid, code: json?.code ?? "AUTH_UNKNOWN_ACTION" },
            { status: 400 }
          )
        }
        return NextResponse.json(
          {
            ok: false,
            error:
              "Password reset is not available on this server yet. Deploy the latest trading_ai WAR (UserAuthServlet with resetPassword), or set FORGOT_PASSWORD_MYSQL_* / ONBOARDING_MYSQL_* in .env.local for a database fallback.",
            code: json?.code ?? "AUTH_UNKNOWN_ACTION",
            rid,
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        {
          ok: false,
          error: json?.error || "Could not reset password",
          rid,
          code: json?.code,
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 400 }
      )
    }

    if (!emailTrimmed) {
      return NextResponse.json(
        { ok: false, error: "Email is required for this request", rid },
        { status: 400 }
      )
    }

    const form = new URLSearchParams()
    form.set("action", "forgot_password")
    form.set("email", emailTrimmed)

    const javaUrl = new URL(JAVA_AUTH_URL)
    javaUrl.searchParams.set("action", "forgot_password")

    const res = await fetch(javaUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    const text = await res.text()
    let json: AuthJson
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      return NextResponse.json(
        { ok: false, error: "Bad response from auth server", raw: text.slice(0, 400), rid },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: json?.ok !== false,
      message:
        json?.message ||
        "If an account exists for that email, you will receive reset instructions shortly.",
      rid,
    })
  } catch (e: unknown) {
    console.error(`[api/auth/forgot-password][${rid}]`, e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error", rid },
      { status: 400 }
    )
  }
}
