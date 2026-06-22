import { NextResponse } from "next/server"
import { getJavaAuthUrlCandidates, isTomcatMissingServlet, warmJavaBackendBase } from "@/lib/backend-config"
import { getJavaSetCookieValues, rewriteForwardedSetCookie } from "@/lib/java-proxy-cookies"
import { normalizePhoneDigitsForAuth, rwJavaLoginIdentifiers } from "@/lib/rwanda-phone"

/** First servlet URL that returned JSON (not Tomcat 404 HTML); avoids probing every login attempt. */
let cachedJavaAuthUrl: string | null = null

export function getLoginFailureCode(
  error: unknown,
  status: number,
  code: unknown
): "invalid_credentials" | "user_not_found" | "server_error" {
  const message = String(error ?? "").toLowerCase()
  const codeText = String(code ?? "").toLowerCase()

  if (
    message.includes("invalid credentials") ||
    message.includes("wrong password") ||
    message.includes("password incorrect") ||
    codeText.includes("invalid_credentials") ||
    codeText.includes("auth_login_fail")
  ) {
    return "invalid_credentials"
  }

  if (
    message.includes("user not found") ||
    message.includes("no account found") ||
    message.includes("account does not exist") ||
    codeText.includes("user_not_found")
  ) {
    return "user_not_found"
  }

  if (
    message.includes("temporarily unavailable") ||
    message.includes("service temporarily unavailable") ||
    codeText.includes("auth_server_error")
  ) {
    return "server_error"
  }

  return status >= 500 ? "server_error" : "invalid_credentials"
}

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    await warmJavaBackendBase()

    const authUrls = cachedJavaAuthUrl ? [cachedJavaAuthUrl] : getJavaAuthUrlCandidates()
    console.log(
      `[api/auth/login][proxyRid=${rid}] START authUrlCandidates=${authUrls.length} first=${authUrls[0] ?? "(none)"}${cachedJavaAuthUrl ? " (cached)" : ""}`
    )

    const { email, password } = await req.json()
    const rawLogin = String(email ?? "").trim()
    const normalizedLogin = normalizePhoneDigitsForAuth(rawLogin) || rawLogin
    const loginCandidates = Array.from(new Set(rwJavaLoginIdentifiers(normalizedLogin).filter(Boolean)))
    console.log(
      `[api/auth/login][proxyRid=${rid}] request raw=${rawLogin || "(empty)"} passwordLen=${password?.length ?? 0} try=${loginCandidates.join(" | ")}`
    )

    if (authUrls.length === 0 || !authUrls[0]) {
      console.error(`[api/auth/login][proxyRid=${rid}] FATAL: no auth URLs`)
      return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
    }

    const loginTimeoutMs = Math.min(
      300_000,
      Math.max(8_000, Number(process.env.JAVA_AUTH_TIMEOUT_MS) || 90_000)
    )
    console.log(
      `[api/auth/login][proxyRid=${rid}] → Java POST (try ${authUrls.length} base URL(s), loginTimeoutMs=${loginTimeoutMs})`
    )

    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), loginTimeoutMs)
    const inboundCookie = req.headers.get("cookie") || ""
    const pwd = String(password || "")

    let json: Record<string, unknown> | null = null
    let res: Response | null = null
    let lastParseError: unknown = null
    let lastServerError: { status: number; parsed: Record<string, unknown>; url: string; loginId: string } | null = null
    let lastNonServerResponse: { status: number; parsed: Record<string, unknown>; url: string; loginId: string } | null = null

    try {
      outer: for (const loginId of loginCandidates) {
        const form = new URLSearchParams()
        form.set("action", "login")
        form.set("email", loginId)
        form.set("password", pwd)

        inner: for (const javaAuthUrl of authUrls) {
          const attempt = await fetch(javaAuthUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...(inboundCookie ? { Cookie: inboundCookie } : {}),
            },
            body: form.toString(),
            cache: "no-store",
            signal: ac.signal,
          })
          const text = await attempt.text()
          if (isTomcatMissingServlet(text, attempt.status)) {
            console.warn(
              `[api/auth/login][proxyRid=${rid}] skip url (404 or HTML) loginId=${loginId} url=${javaAuthUrl}`
            )
            continue inner
          }

          let parsed: Record<string, unknown>
          try {
            parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
          } catch (pe) {
            lastParseError = pe
            console.error(
              `[api/auth/login][proxyRid=${rid}] invalid JSON for loginId=${loginId} url=${javaAuthUrl} raw=${text.slice(0, 200)}`
            )
            continue inner
          }

          cachedJavaAuthUrl = javaAuthUrl

          console.log(
            `[api/auth/login][proxyRid=${rid}] try loginId=${loginId} url=${javaAuthUrl} http=${attempt.status} ok=${parsed?.ok} code=${String(parsed?.code ?? "")}`
          )

          if (attempt.status >= 500) {
            lastServerError = { status: attempt.status, parsed, url: javaAuthUrl, loginId }
            console.warn(
              `[api/auth/login][proxyRid=${rid}] server error for loginId=${loginId} url=${javaAuthUrl} status=${attempt.status} code=${String(parsed?.code ?? "")}`
            )
            continue inner
          }

          res = attempt
          json = parsed
          if (attempt.ok && parsed?.ok === true) {
            break outer
          }

          lastNonServerResponse = { status: attempt.status, parsed, url: javaAuthUrl, loginId }
          // Reached Java with valid JSON (e.g. wrong password); do not try other base URLs for this loginId.
          break inner
        }
      }
    } finally {
      clearTimeout(to)
    }

    if (lastNonServerResponse) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] returning last auth failure loginId=${lastNonServerResponse.loginId} url=${lastNonServerResponse.url} status=${lastNonServerResponse.status}`
      )
      const failureCode = getLoginFailureCode(lastNonServerResponse.parsed?.error, lastNonServerResponse.status, lastNonServerResponse.parsed?.code)
      return NextResponse.json(
        {
          ok: false,
          error: (lastNonServerResponse.parsed?.error as string) || `Auth failed (${lastNonServerResponse.status})`,
          rid,
          javaRid: typeof lastNonServerResponse.parsed?.rid === "string" ? lastNonServerResponse.parsed.rid : undefined,
          code: failureCode,
        },
        { status: 401 }
      )
    }

    if (lastServerError) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] returning last server error loginId=${lastServerError.loginId} url=${lastServerError.url} status=${lastServerError.status}`
      )
      const failureCode = getLoginFailureCode(lastServerError.parsed?.error, lastServerError.status, lastServerError.parsed?.code)
      return NextResponse.json(
        {
          ok: false,
          error: (lastServerError.parsed?.error as string) || "Auth failed due to server error",
          rid,
          javaRid: typeof lastServerError.parsed?.rid === "string" ? lastServerError.parsed.rid : undefined,
          code: failureCode,
        },
        { status: lastServerError.status >= 400 && lastServerError.status < 600 ? lastServerError.status : 502 }
      )
    }

    if (!json || !res) {
      console.error(`[api/auth/login][proxyRid=${rid}] FATAL: no response`, lastParseError)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not reach Java login on any probed URL (Tomcat 404). Start Tomcat and deploy this WAR, or set BACKEND_URL / JAVA_BACKEND_BASE (e.g. http://localhost:8080/Trading). Probe uses localhost ports 8080–8082 and contexts Trading, Ihute, trading_ai.",
          rid,
          code: "server_error",
        },
        { status: 502 },
      )
    }

    const javaMeta = {
      rid,
      javaRid: typeof json.rid === "string" ? json.rid : undefined,
      code: typeof json.code === "string" ? json.code : undefined,
    }

    if (!res.ok) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] Java HTTP !ok status=${res.status} javaRid=${javaMeta.javaRid ?? "n/a"} code=${javaMeta.code ?? "n/a"}`
      )
      const failureCode = getLoginFailureCode(json.error, res.status, json.code)
      return NextResponse.json(
        {
          ok: false,
          error: (json.error as string) || `Auth failed (${res.status})`,
          ...javaMeta,
          code: failureCode,
        },
        { status: 401 }
      )
    }

    if (!json?.ok) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] login rejected javaRid=${javaMeta.javaRid ?? "n/a"} code=${javaMeta.code ?? "n/a"} error=${String(json?.error ?? "")}`
      )
      const failureCode = getLoginFailureCode(json.error, res.status, json.code)
      return NextResponse.json(
        {
          ok: false,
          error: (json.error as string) || "Login failed",
          ...javaMeta,
          code: failureCode,
        },
        { status: 401 }
      )
    }

    const mcp = json?.mustChangePassword ?? json?.must_change_password
    const okEmail =
      typeof (json.user as { email?: string } | undefined)?.email === "string"
        ? String((json.user as { email: string }).email).trim()
        : typeof json.email === "string"
          ? String(json.email).trim()
          : rawLogin
    console.log(
      `[user-auth] logged in as ${okEmail || rawLogin} role=${String(json?.role ?? "").toLowerCase() || "n/a"}`
    )
    console.log(
      `[api/auth/login][proxyRid=${rid}] SUCCESS role=${String(json?.role)} ishyiga=${String(json?.ishyiga ?? "n/a")} javaRid=${javaMeta.javaRid ?? "n/a"} mustChangePassword=${String(mcp)} (type=${typeof mcp})`
    )

    // Forward Set-Cookie headers from Java backend to client
    const response = NextResponse.json({ ...json, rid, javaRid: javaMeta.javaRid })

    const setCookies = getJavaSetCookieValues(res.headers)
    if (setCookies.length > 0) {
      for (const raw of setCookies) {
        response.headers.append("Set-Cookie", rewriteForwardedSetCookie(raw))
      }
    } else {
      console.warn(`[api/auth/login][proxyRid=${rid}] no Set-Cookie from Java`)
    }

    return response
  } catch (e: any) {
    console.error(`[api/auth/login][proxyRid=${rid}] EXCEPTION`, e?.constructor?.name, e?.message, e?.stack)
    if (e?.name === "AbortError") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Auth server did not respond in time. Check Tomcat and DB, or raise JAVA_AUTH_TIMEOUT_MS (default 90s, max 300s).",
          rid,
        },
        { status: 504 },
      )
    }
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error", rid }, { status: 400 })
  } finally {
    const ms = Date.now() - t0
    console.log(`[api/auth/login][proxyRid=${rid}] DONE ${ms}ms`)
  }
}