import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getBackendBase } from "@/lib/backend-config"

const BACKEND_URL = getBackendBase()

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
    const adminTokenFromBody =
      typeof (params as { adminToken?: unknown }).adminToken === "string"
        ? String((params as { adminToken?: string }).adminToken).trim()
        : ""

    if (!action) {
      console.error("[admin/route] POST - Missing action parameter. Body was:", JSON.stringify(body))
      return NextResponse.json(
        { ok: false, error: "action parameter is required", received: body },
        { status: 400 }
      )
    }
    
    console.log("[admin/route] POST - Action:", action, "Params:", JSON.stringify(params))

    const publicActions = ["getHomepageCategories"]
    const needsAuth = !publicActions.includes(action)

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
    form.set("action", action)

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

    const url = `${BACKEND_URL}/AdminServlet`
    console.log("[admin/route] Calling backend:", url)
    console.log("[admin/route] Action:", action)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const inboundCookie = req.headers.get("cookie") || ""
    const res = await fetch(url, {
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
    
    clearTimeout(timeoutId)

    const text = await res.text()
    console.log("[admin/route] POST - Backend response status:", res.status)
    console.log("[admin/route] POST - Backend response (first 500 chars):", text.substring(0, 500))
    
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {
      console.error("[admin/route] POST - Failed to parse JSON:", e)
      return NextResponse.json(
        { 
          ok: false, 
          error: "Invalid JSON response from backend", 
          raw: text.substring(0, 500),
          status: res.status,
          url
        },
        { status: 500 }
      )
    }

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
        { ok: false, error: "Backend request timed out after 30 seconds" },
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

    const url = `${BACKEND_URL}/AdminServlet?${params.toString()}`
    console.log("[admin/route] GET - Calling backend:", url)
    console.log("[admin/route] GET - Action:", action)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const inboundCookie = req.headers.get("cookie") || ""
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(inboundCookie ? { Cookie: inboundCookie } : {}),
        ...(tokenForJava ? { "X-Admin-Token": tokenForJava } : {}),
      },
      signal: controller.signal,
      cache: "no-store",
    })
    
    clearTimeout(timeoutId)

    const text = await res.text()
    console.log("[admin/route] GET - Backend response status:", res.status)
    console.log("[admin/route] GET - Backend response (first 500 chars):", text.substring(0, 500))
    
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {
      console.error("[admin/route] GET - Failed to parse JSON:", e)
      return NextResponse.json(
        { 
          ok: false, 
          error: "Invalid JSON response from backend", 
          raw: text.substring(0, 500),
          status: res.status,
          url
        },
        { status: 500 }
      )
    }

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
        { ok: false, error: "Backend request timed out after 30 seconds" },
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
