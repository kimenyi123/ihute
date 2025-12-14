import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/Trading"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, ...params } = body

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action parameter is required" },
        { status: 400 }
      )
    }

    // Get admin email from cookies or session
    const publicActions = ['getHomepageCategories']
    const needsAuth = !publicActions.includes(action)
    
    // Try to get admin email from cookies (set by frontend after login)
    const cookies = req.headers.get('cookie') || ''
    let adminEmail = ''
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
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON response from backend", raw: text.substring(0, 200) },
        { status: 500 }
      )
    }

    if (!json.ok) {
      return NextResponse.json(json, { status: 400 })
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[admin/route] Error:", e?.message)
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal server error" },
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
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON response from backend", raw: text.substring(0, 200) },
        { status: 500 }
      )
    }

    if (!json.ok) {
      return NextResponse.json(json, { status: 400 })
    }

    return NextResponse.json(json)
  } catch (e: any) {
    console.error("[admin/route] Error:", e?.message)
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
