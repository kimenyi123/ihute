import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/backend-config"

const JAVA_AUTH_URL = getAuthUrl()

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    console.log(`[api/auth/login][proxyRid=${rid}] START JAVA_AUTH_URL=${JAVA_AUTH_URL}`)

    const { email, password } = await req.json()
    const emailTrimmed = String(email ?? "").trim()
    console.log(
      `[api/auth/login][proxyRid=${rid}] request email=${emailTrimmed || "(empty)"} passwordLen=${password?.length ?? 0}`
    )

    if (!JAVA_AUTH_URL) {
      console.error(`[api/auth/login][proxyRid=${rid}] FATAL: JAVA_AUTH_URL not set`)
      return NextResponse.json({ ok: false, error: "Auth backend not configured", rid }, { status: 500 })
    }

    const form = new URLSearchParams()
    form.set("action", "login")
    form.set("email", emailTrimmed)
    form.set("password", String(password || ""))

    console.log(`[api/auth/login][proxyRid=${rid}] → Java POST ${JAVA_AUTH_URL}`)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    console.log(`[api/auth/login][proxyRid=${rid}] ← Java HTTP ${res.status}`)

    const text = await res.text()
    console.log(`[api/auth/login][proxyRid=${rid}] body (500): ${text.slice(0, 500)}`)

    let json: any
    try {
      json = JSON.parse(text)
      const javaRid = json?.rid
      const javaCode = json?.code
      console.log(
        `[api/auth/login][proxyRid=${rid}] parsed ok=${json?.ok} javaRid=${javaRid ?? "n/a"} code=${javaCode ?? "n/a"} error=${json?.error ?? "n/a"}`
      )
    } catch (parseError) {
      console.error(`[api/auth/login][proxyRid=${rid}] FATAL: invalid JSON from Java`, parseError)
      console.error(`[api/auth/login][proxyRid=${rid}] raw (800): ${text.slice(0, 800)}`)
      return NextResponse.json(
        { ok: false, error: "Bad JSON from auth server", raw: text.slice(0, 800), rid },
        { status: 502 },
      )
    }

    const javaMeta = {
      rid,
      javaRid: typeof json?.rid === "string" ? json.rid : undefined,
      code: typeof json?.code === "string" ? json.code : undefined,
    }

    if (!res.ok) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] Java HTTP !ok status=${res.status} javaRid=${javaMeta.javaRid ?? "n/a"} code=${javaMeta.code ?? "n/a"}`
      )
      return NextResponse.json(
        {
          ok: false,
          error: json?.error || `Auth failed (${res.status})`,
          ...javaMeta,
        },
        { status: 401 }
      )
    }

    if (!json?.ok) {
      console.warn(
        `[api/auth/login][proxyRid=${rid}] login rejected javaRid=${javaMeta.javaRid ?? "n/a"} code=${javaMeta.code ?? "n/a"} error=${json?.error}`
      )
      return NextResponse.json(
        {
          ok: false,
          error: json?.error || "Login failed",
          ...javaMeta,
        },
        { status: 401 }
      )
    }

    const mcp = json?.mustChangePassword ?? json?.must_change_password
    console.log(
      `[api/auth/login][proxyRid=${rid}] SUCCESS role=${json?.role} ishyiga=${json?.ishyiga ?? "n/a"} javaRid=${javaMeta.javaRid ?? "n/a"} mustChangePassword=${String(mcp)} (type=${typeof mcp})`
    )

    // Forward Set-Cookie headers from Java backend to client
    const response = NextResponse.json({ ...json, rid, javaRid: javaMeta.javaRid })

    // Try to read multiple Set-Cookie headers if available
    // Some fetch implementations expose a single combined header, others provide get('set-cookie')
    const setCookieHeader = res.headers.get("set-cookie")
    if (setCookieHeader) {
      // Rewrite Path=/Trading -> Path=/ so cookie is sent for all frontend routes
      let rewritten = setCookieHeader.replace(/Path=\/Trading/gi, "Path=/")
      // Ensure SameSite is present for modern browsers
      if (!/samesite=/i.test(rewritten)) {
        rewritten += "; SameSite=Lax"
      }
      response.headers.append("Set-Cookie", rewritten)
    } else {
      console.warn(`[api/auth/login][proxyRid=${rid}] no Set-Cookie from Java`)
    }

    return response
  } catch (e: any) {
    console.error(`[api/auth/login][proxyRid=${rid}] EXCEPTION`, e?.constructor?.name, e?.message, e?.stack)
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error", rid }, { status: 400 })
  } finally {
    const ms = Date.now() - t0
    console.log(`[api/auth/login][proxyRid=${rid}] DONE ${ms}ms`)
  }
}