import { NextRequest, NextResponse } from "next/server"
import { getAdminServletUrl } from "@/lib/backend-config"

const STOCK_SYNC_LOGS_API_SECRET = process.env.STOCK_SYNC_LOGS_API_SECRET?.trim() || ""

/** Short-lived positive auth cache to avoid hitting AdminServlet on every log row refresh. */
const verifyOkUntil = new Map<string, number>()
const CACHE_MS = 45_000

type PersistedSlice = {
  isAuthenticated?: boolean
  user?: { role?: string; email?: string } | null
  loginTime?: number | null
  lastActivityAt?: number | null
  sessionTimeout?: number
}

function parseAuthStorageCookie(cookieHeader: string): PersistedSlice | null {
  const authMatch = cookieHeader.match(/auth-storage=([^;]+)/)
  if (!authMatch?.[1]) return null
  try {
    const decoded = decodeURIComponent(authMatch[1])
    const parsed = JSON.parse(decoded) as { state?: PersistedSlice }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

function cookieAdminSessionOk(state: PersistedSlice | null): boolean {
  if (!state?.isAuthenticated || state.user?.role !== "admin") return false
  const email = typeof state.user?.email === "string" ? state.user.email.trim() : ""
  if (!email) return false
  const now = Date.now()
  const anchor = state.lastActivityAt ?? state.loginTime
  if (anchor == null) return false
  const timeout = typeof state.sessionTimeout === "number" ? state.sessionTimeout : 60 * 60 * 1000
  return now - anchor <= timeout
}

async function verifyAdminServlet(adminEmail: string, adminToken: string | undefined): Promise<boolean> {
  const email = adminEmail.trim()
  if (!email) return false
  const cacheKey = `${email}\0${adminToken ?? ""}`
  const until = verifyOkUntil.get(cacheKey)
  if (until != null && until > Date.now()) return true

  const form = new URLSearchParams()
  form.set("action", "getCommissionSettings")
  form.set("adminEmail", email)
  const tok = adminToken?.trim()
  if (tok) form.set("adminToken", tok)

  try {
    const url = getAdminServletUrl()
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return false
    const text = await res.text()
    let parsed: { ok?: boolean }
    try {
      parsed = JSON.parse(text) as { ok?: boolean }
    } catch {
      return false
    }
    if (parsed.ok === true) {
      verifyOkUntil.set(cacheKey, Date.now() + CACHE_MS)
      return true
    }
    return false
  } catch {
    return false
  }
}

function bearerMatches(req: NextRequest): boolean {
  if (!STOCK_SYNC_LOGS_API_SECRET) return false
  const auth = req.headers.get("authorization")?.trim()
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim()
    if (t && t === STOCK_SYNC_LOGS_API_SECRET) return true
  }
  const h = req.headers.get("x-stock-sync-logs-secret")?.trim()
  return Boolean(h && h === STOCK_SYNC_LOGS_API_SECRET)
}

/**
 * @returns `null` if access allowed; otherwise a ready {@link NextResponse} (401/503).
 */
export async function assertStockSyncLogsAccess(req: NextRequest): Promise<NextResponse | null> {
  if (bearerMatches(req)) {
    return null
  }

  const cookies = req.headers.get("cookie") || ""
  const fromCookie = parseAuthStorageCookie(cookies)
  if (cookieAdminSessionOk(fromCookie)) {
    return null
  }

  const headerEmail = req.headers.get("x-admin-email")?.trim() || ""
  const headerToken = req.headers.get("x-admin-token")?.trim() || ""

  if (!headerEmail) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized. Sign in as admin, or call with Authorization: Bearer and STOCK_SYNC_LOGS_API_SECRET.",
      },
      { status: 401 },
    )
  }

  const ok = await verifyAdminServlet(headerEmail, headerToken || undefined)
  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Admin verification failed via ${getAdminServletUrl()}. Sign in again, or set JAVA_BACKEND_BASE / BACKEND_URL to this site's Tomcat WAR (same context as search).`,
      },
      { status: 401 },
    )
  }

  return null
}
