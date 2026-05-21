import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"
import { resetPasswordViaMysql } from "@/lib/forgot-password-mysql"
import { coerceTelRawForPasswordReset, rwJavaResetTelVariants } from "@/lib/rwanda-phone"

const JAVA_AUTH_URL = getAuthUrl()

/** Per-Java-attempt cap so slow Tomcat cannot block the route for many minutes (7 variants × this). */
function javaResetFetchTimeoutMs(): number {
  const n = Number(process.env.JAVA_AUTH_RESET_FETCH_MS)
  if (Number.isFinite(n) && n >= 3_000) return Math.min(n, 90_000)
  return 18_000
}

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
    const telRaw = coerceTelRawForPasswordReset(String(body?.tel ?? ""))
    const telVariants = telRaw ? rwJavaResetTelVariants(telRaw) : []
    const streetNumber = String(body?.streetNumber ?? "").trim()
    const newPassword = String(body?.newPassword ?? "")

    const isResetFlow = Boolean(telRaw && streetNumber && newPassword)

    if (isResetFlow) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { ok: false, error: "Password must be at least 6 characters", rid },
          { status: 400 }
        )
      }

      const fbPre = await resetPasswordViaMysql(telRaw, streetNumber, newPassword)
      if (fbPre.ok) {
        console.log(`[api/auth/forgot-password][${rid}] MySQL ok in ${Date.now() - t0}ms`)
        return NextResponse.json({ ok: true, message: "Password updated", rid, via: "mysql" })
      }
      if (fbPre.error !== "no_db") {
        console.warn(`[api/auth/forgot-password][${rid}] mysql (continuing to Java): ${fbPre.error}`)
      }

      const javaUrl = new URL(JAVA_AUTH_URL)
      javaUrl.searchParams.set("action", "resetPassword")
      const javaFetchMs = javaResetFetchTimeoutMs()

      let lastJson: AuthJson = {}
      let lastRes: Response | null = null
      let lastFetchErr: string | null = null

      type JavaAttempt =
        | { tel: string; kind: "ok"; res: Response; json: AuthJson }
        | { tel: string; kind: "fetch_err"; err: string }
        | { tel: string; kind: "bad_json"; raw: string }

      const javaAttempts = await Promise.all(
        telVariants.map(async (tel): Promise<JavaAttempt> => {
          const form = new URLSearchParams()
          form.set("action", "resetPassword")
          if (emailTrimmed) form.set("email", emailTrimmed)
          form.set("tel", tel)
          form.set("streetNumber", streetNumber)
          form.set("newPassword", newPassword)
          try {
            const res = await fetch(javaUrl.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: form.toString(),
              cache: "no-store",
              signal: AbortSignal.timeout(javaFetchMs),
            })
            const text = await res.text()
            let json: AuthJson
            try {
              json = text ? JSON.parse(text) : {}
            } catch {
              return { tel, kind: "bad_json" as const, raw: text.slice(0, 400) }
            }
            return { tel, kind: "ok" as const, res, json }
          } catch (e: unknown) {
            const err = e instanceof Error ? e.message : String(e)
            return { tel, kind: "fetch_err" as const, err }
          }
        })
      )

      for (const a of javaAttempts) {
        if (a.kind === "bad_json") {
          return NextResponse.json(
            { ok: false, error: "Bad response from auth server", raw: a.raw, rid },
            { status: 502 }
          )
        }
      }

      for (const a of javaAttempts) {
        if (a.kind === "fetch_err") {
          lastFetchErr = a.err
          console.warn(`[api/auth/forgot-password][${rid}] Java fetch failed tel=${a.tel}: ${a.err}`)
          continue
        }
        if (a.kind !== "ok") continue
        const { tel, res, json } = a
        lastRes = res
        lastJson = json
        console.log(
          `[api/auth/forgot-password][${rid}] try tel=${tel} http=${res.status} ok=${json?.ok} code=${json?.code ?? ""} error=${json?.error ?? ""}`
        )
        if (json?.ok === true) {
          console.log(`[api/auth/forgot-password][${rid}] Java ok in ${Date.now() - t0}ms (tel=${tel})`)
          return NextResponse.json({ ok: true, message: json.message ?? "Password updated", rid, via: "java" })
        }
      }

      if (isUnknownAction(lastJson)) {
        const hint =
          fbPre.error !== "no_db" && fbPre.error
            ? ` MySQL fallback: ${fbPre.error}`
            : ""
        return NextResponse.json(
          {
            ok: false,
            error:
              "Password reset is not available on this server yet. Deploy the latest trading_ai WAR (UserAuthServlet with resetPassword), or set FORGOT_PASSWORD_MYSQL_* / ONBOARDING_MYSQL_* in .env.local for a database fallback." +
              hint,
            code: lastJson?.code ?? "AUTH_UNKNOWN_ACTION",
            rid,
          },
          { status: 503 }
        )
      }

      if (fbPre.error !== "no_db") {
        const javaErr = String(lastJson?.error ?? "").trim()
        const merged =
          javaErr && javaErr !== fbPre.error
            ? `${javaErr} (${fbPre.error})`
            : fbPre.error || javaErr || "Could not reset password"
        return NextResponse.json(
          { ok: false, error: merged, rid, code: lastJson?.code ?? "AUTH_RESET_FAIL" },
          { status: 400 }
        )
      }

      const st = lastRes?.status && lastRes.status >= 400 && lastRes.status < 600 ? lastRes.status : 400
      const errOut =
        lastJson?.error?.trim() ||
        (lastFetchErr ? `Auth server unreachable or timed out (${lastFetchErr})` : "Could not reset password")
      return NextResponse.json(
        {
          ok: false,
          error: errOut,
          rid,
          code: lastJson?.code ?? (lastFetchErr ? "AUTH_RESET_FETCH" : undefined),
        },
        { status: st }
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
