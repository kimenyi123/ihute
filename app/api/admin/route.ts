import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getBackendBase } from "@/lib/backend-config"

const BACKEND_URL = getBackendBase()

export async function POST(req: Request) {
  try {
    // Parse request body - use req.json() for Next.js API routes
    let body: any = {}
    try {
      body = await req.json()
      console.log("[admin/route] POST - Parsed body:", JSON.stringify(body))
    } catch (parseError: any) {
      console.error("[admin/route] POST - Failed to parse JSON body:", parseError?.message)
      console.error("[admin/route] POST - Error stack:", parseError?.stack)
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in request body", details: parseError?.message },
        { status: 400 }
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

    if (!action) {
      console.error("[admin/route] POST - Missing action parameter. Body was:", JSON.stringify(body))
      return NextResponse.json(
        { ok: false, error: "action parameter is required", received: body },
        { status: 400 }
      )
    }
    
    console.log("[admin/route] POST - Action:", action, "Params:", JSON.stringify(params))

    // Get admin email from request body or cookies
    const publicActions = ['getHomepageCategories']
    const needsAuth = !publicActions.includes(action)
    
    // First, try to get admin email from request body (preferred method)
    let adminEmail = params.adminEmail || ''
    
    // Fallback: Try to get admin email from cookies (set by frontend after login)
    if (!adminEmail) {
      const cookies = req.headers.get('cookie') || ''
      if (cookies) {
        const authMatch = cookies.match(/auth-storage=([^;]+)/)
        if (authMatch) {
          try {
            const authData = JSON.parse(decodeURIComponent(authMatch[1]))
            if (authData?.state?.user?.role === 'admin' && authData?.state?.user?.email) {
              adminEmail = authData.state.user.email
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Build form data for servlet
    const form = new URLSearchParams()
    form.set("action", action)
    
    // Add admin email for authentication (if needed and available)
    if (needsAuth && adminEmail) {
      form.set("adminEmail", adminEmail)
    }
    
    // Add all other parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        form.set(key, String(value))
      }
    })

    const url = `${BACKEND_URL}/AdminServlet`
    console.log("[admin/route] Calling backend:", url)
    console.log("[admin/route] Action:", action)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
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
      return NextResponse.json(json, { status: 400 })
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
    const params = new URLSearchParams()
    params.set("action", action)
    
    // Add all query parameters
    searchParams.forEach((value, key) => {
      if (key !== "action") {
        params.set(key, value)
      }
    })

    const url = `${BACKEND_URL}/AdminServlet?${params.toString()}`
    console.log("[admin/route] GET - Calling backend:", url)
    console.log("[admin/route] GET - Action:", action)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
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
      return NextResponse.json(json, { status: 400 })
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
