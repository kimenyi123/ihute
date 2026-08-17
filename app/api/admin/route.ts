import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getAdminServletUrl, getBackendBase } from "@/lib/backend-config"

const BACKEND_URL = getBackendBase()

const HEAVY_ADMIN_ACTIONS = new Set(["getAllOrders", "getOrderMonitorStats", "getOrderDetails"])

function adminFetchTimeoutMs(action: string): number {
  return HEAVY_ADMIN_ACTIONS.has(action) ? 90_000 : 30_000
}

function getAdminServletCandidates(): string[] {
  return [getAdminServletUrl()]
}

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {}
    const raw = await req.text()
    const trimmed = raw?.trim() ?? ""
    if (!trimmed) {
      return NextResponse.json(
        { ok: false, error: "Empty request body. Send JSON with { \"action\": \"...\" }." },
        { status: 400 },
      )
    }
    try {
      body = JSON.parse(trimmed) as Record<string, unknown>
      console.log("[admin/route] POST - Parsed body:", JSON.stringify(body))
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError)
      console.error("[admin/route] POST - Failed to parse JSON body:", msg)
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in request body", details: msg },
        { status: 400 },
      )
    }
    
    // Check if body is empty or action is missing
    if (!body || typeof body !== 'object') {
      console.error("[admin/route] POST - Invalid body type:", typeof body, body)
      return NextResponse.json(
        { ok: false, error: "Request body must be a JSON object", received: body },
        { status: 400 }
      )
    }
    
    const { action, ...params } = body
    const actionStr = typeof action === "string" ? action.trim() : ""
    const adminTokenFromBody =
      typeof (params as { adminToken?: unknown }).adminToken === "string"
        ? String((params as { adminToken?: string }).adminToken).trim()
        : ""

    if (!actionStr) {
      console.error("[admin/route] POST - Missing action parameter. Body was:", JSON.stringify(body))
      return NextResponse.json(
        { ok: false, error: "action parameter is required", received: body },
        { status: 400 }
      )
    }
    
    console.log("[admin/route] POST - Action:", actionStr, "Params:", JSON.stringify(params))

    const publicActions = ["getHomepageCategories"]
    const needsAuth = !publicActions.includes(actionStr)

    const headerEmail = req.headers.get("x-admin-email")?.trim() || ""
    const bodyEmail =
      typeof params.adminEmail === "string" ? String(params.adminEmail).trim() : ""

    let adminEmail = ""
    if (headerEmail) {
      adminEmail = headerEmail
    } else {
      const cookies = req.headers.get("cookie") || ""
      const authMatch = cookies.match(/auth-storage=([^;]+)/)
      if (authMatch) {
        try {
          const authData = JSON.parse(decodeURIComponent(authMatch[1]))
          if (authData?.state?.user?.role === "admin" && authData?.state?.user?.email) {
            adminEmail = String(authData.state.user.email).trim()
          }
        } catch {
          /* ignore */
        }
      }
      if (!adminEmail) {
        adminEmail = bodyEmail
      }
    }

    if (headerEmail && bodyEmail && headerEmail.toLowerCase() !== bodyEmail.toLowerCase()) {
      console.warn("[admin/route] using x-admin-email; ignoring mismatched body.adminEmail")
    }

    const headerAdminToken = req.headers.get("x-admin-token")?.trim() || ""
    const tokenForJava = adminTokenFromBody || headerAdminToken

    const form = new URLSearchParams()
    form.set("action", actionStr)

    if (needsAuth && !adminEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Admin email missing for this action. Sign in again as admin, or ensure the client sends x-admin-email.",
        },
        { status: 401 },
      )
    }

    if (needsAuth && adminEmail) {
      form.set("adminEmail", adminEmail)
    }
    if (needsAuth && tokenForJava) {
      form.set("adminToken", tokenForJava)
    }

    Object.entries(params).forEach(([key, value]) => {
      if (key === "adminEmail" || key === "adminToken") return
      if (value !== null && value !== undefined) {
        form.set(key, String(value))
      }
    })

    const urls = getAdminServletCandidates()
    console.log("[admin/route] POST - Candidate URLs:", urls.join(" | "))
    console.log("[admin/route] POST - Action:", actionStr)

    const timeoutMs = adminFetchTimeoutMs(actionStr)
    const inboundCookie = req.headers.get("cookie") || ""
    let res: Response | null = null
    let text = ""
    let json: any = null
    let url = urls[0]

    for (const candidate of urls) {
      url = candidate
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const attemptRes = await fetch(candidate, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            ...(inboundCookie ? { Cookie: inboundCookie } : {}),
            ...(tokenForJava ? { "X-Admin-Token": tokenForJava } : {}),
          },
          body: form.toString(),
          signal: controller.signal,
          cache: "no-store",
        })
        const attemptText = await attemptRes.text()
        clearTimeout(timeoutId)
        console.log("[admin/route] POST - Attempt:", candidate, "status:", attemptRes.status)
        res = attemptRes
        text = attemptText
        try {
          json = JSON.parse(attemptText)
          break
        } catch {
          // Try next candidate when endpoint returns HTML/plain text (common for wrong servlet mapping)
          continue
        }
      } catch (attemptErr: any) {
        clearTimeout(timeoutId)
        console.error("[admin/route] POST - Attempt failed:", candidate, attemptErr?.message)
        res = null
        text = ""
        json = null
      }
    }

    if (!res || !json) {
      const status = res?.status ?? 502
      const trimmed = text.trim()
      const looksLikeHtml = /<!doctype|<html/i.test(trimmed)
      const hint = looksLikeHtml
        ? "Backend returned HTML (wrong URL or servlet not deployed). Check BACKEND_URL / JAVA_BACKEND_BASE."
        : !res
          ? "Could not reach Java backend. Is Tomcat running?"
          : "Backend response was not JSON."
      return NextResponse.json(
        {
          ok: false,
          error: hint,
          raw: trimmed.substring(0, 500),
          status,
          url,
          action: actionStr,
        },
        { status: status >= 400 && status < 600 ? status : 502 },
      )
    }

    console.log("[admin/route] POST - Backend response status:", res.status)
    console.log("[admin/route] POST - Backend response (first 500 chars):", text.substring(0, 500))

    if (!json.ok) {
      const st =
        res.status === 401 || res.status === 403
          ? res.status
          : res.status >= 400 && res.status < 600
            ? res.status
            : 400
      return NextResponse.json(json, { status: st })
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[admin/route] POST - Error:", e?.message)
    console.error("[admin/route] POST - Stack:", e?.stack)
    console.error("[admin/route] POST - Backend URL:", BACKEND_URL)
    
    if (e?.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, error: "Backend request timed out" },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: e?.message || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? {
          stack: e?.stack,
          backendUrl: BACKEND_URL,
          type: e?.name
        } : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") || ""

  if (!action) {
    return NextResponse.json(
      { ok: false, error: "action parameter is required" },
      { status: 400 }
    )
  }

  try {
    const paramRecord: Record<string, unknown> = {}
    searchParams.forEach((value, key) => {
      if (key !== "action") paramRecord[key] = value
    })

    const publicActions = ["getHomepageCategories"]
    const needsAuth = !publicActions.includes(action)
    const headerEmail = req.headers.get("x-admin-email")?.trim() || ""
    const bodyEmail =
      typeof paramRecord.adminEmail === "string" ? String(paramRecord.adminEmail).trim() : ""
    let adminEmail = headerEmail
    if (!adminEmail) {
      const cookies = req.headers.get("cookie") || ""
      const authMatch = cookies.match(/auth-storage=([^;]+)/)
      if (authMatch) {
        try {
          const authData = JSON.parse(decodeURIComponent(authMatch[1]))
          if (authData?.state?.user?.role === "admin" && authData?.state?.user?.email) {
            adminEmail = String(authData.state.user.email).trim()
          }
        } catch {
          /* ignore */
        }
      }
      if (!adminEmail) adminEmail = bodyEmail
    }
    const headerTok = req.headers.get("x-admin-token")?.trim() || ""
    const bodyTok =
      typeof paramRecord.adminToken === "string" ? String(paramRecord.adminToken).trim() : ""
    const tokenForJava = bodyTok || headerTok

    const params = new URLSearchParams()
    params.set("action", action)
    searchParams.forEach((value, key) => {
      if (key !== "action") {
        params.set(key, value)
      }
    })

    if (needsAuth && !adminEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin email missing. Send x-admin-email (or adminEmail query) after signing in as admin.",
        },
        { status: 401 },
      )
    }
    if (needsAuth && adminEmail) {
      params.set("adminEmail", adminEmail)
    }
    if (needsAuth && tokenForJava) {
      params.set("adminToken", tokenForJava)
    }

    const baseUrls = getAdminServletCandidates()
    const urls = baseUrls.map((u) => `${u}?${params.toString()}`)
    console.log("[admin/route] GET - Candidate URLs:", urls.join(" | "))
    console.log("[admin/route] GET - Action:", action)

    const timeoutMs = adminFetchTimeoutMs(action)
    const inboundCookie = req.headers.get("cookie") || ""
    let res: Response | null = null
    let text = ""
    let json: any = null
    let url = urls[0]

    for (const candidate of urls) {
      url = candidate
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const attemptRes = await fetch(candidate, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(inboundCookie ? { Cookie: inboundCookie } : {}),
            ...(tokenForJava ? { "X-Admin-Token": tokenForJava } : {}),
          },
          signal: controller.signal,
          cache: "no-store",
        })
        const attemptText = await attemptRes.text()
        clearTimeout(timeoutId)
        console.log("[admin/route] GET - Attempt:", candidate, "status:", attemptRes.status)
        res = attemptRes
        text = attemptText
        try {
          json = JSON.parse(attemptText)
          break
        } catch {
          continue
        }
      } catch (attemptErr: any) {
        clearTimeout(timeoutId)
        console.error("[admin/route] GET - Attempt failed:", candidate, attemptErr?.message)
        res = null
        text = ""
        json = null
      }
    }

    if (!res || !json) {
      const status = res?.status ?? 502
      const trimmed = text.trim()
      const looksLikeHtml = /<!doctype|<html/i.test(trimmed)
      const hint = looksLikeHtml
        ? "Backend returned HTML (wrong URL or servlet not deployed). Check BACKEND_URL / JAVA_BACKEND_BASE."
        : !res
          ? "Could not reach Java backend. Is Tomcat running?"
          : "Backend response was not JSON."
      return NextResponse.json(
        {
          ok: false,
          error: hint,
          raw: trimmed.substring(0, 500),
          status,
          url,
          action,
        },
        { status: status >= 400 && status < 600 ? status : 502 },
      )
    }

    console.log("[admin/route] GET - Backend response status:", res.status)
    console.log("[admin/route] GET - Backend response (first 500 chars):", text.substring(0, 500))

    if (!json.ok) {
      const st =
        res.status === 401 || res.status === 403
          ? res.status
          : res.status >= 400 && res.status < 600
            ? res.status
            : 400
      return NextResponse.json(json, { status: st })
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[admin/route] GET - Error:", e?.message)
    console.error("[admin/route] GET - Stack:", e?.stack)
    console.error("[admin/route] GET - Backend URL:", BACKEND_URL)
    
    if (e?.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, error: `Backend request timed out after ${Math.round(adminFetchTimeoutMs(action) / 1000)} seconds` },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: e?.message || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? {
          stack: e?.stack,
          backendUrl: BACKEND_URL,
          type: e?.name
        } : undefined
      },
      { status: 500 }
    )
  }
}
