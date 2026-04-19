/**
 * Session-scoped stats for `fetch` calls to `/api/*` from the Grandma shell (see GrandmaFetchTracker).
 */

const STORAGE_KEY = "grandma_fetch_stats_v1"

export type GrandmaFetchStats = {
  total: number
  ok: number
  fail: number
  lastFailUrl: string | null
  lastFailStatus: number | null
  lastFailAt: number | null
}

function read(): GrandmaFetchStats {
  if (typeof window === "undefined") {
    return { total: 0, ok: 0, fail: 0, lastFailUrl: null, lastFailStatus: null, lastFailAt: null }
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { total: 0, ok: 0, fail: 0, lastFailUrl: null, lastFailStatus: null, lastFailAt: null }
    }
    const p = JSON.parse(raw) as Partial<GrandmaFetchStats>
    return {
      total: Number(p.total) || 0,
      ok: Number(p.ok) || 0,
      fail: Number(p.fail) || 0,
      lastFailUrl: typeof p.lastFailUrl === "string" ? p.lastFailUrl : null,
      lastFailStatus: p.lastFailStatus != null ? Number(p.lastFailStatus) : null,
      lastFailAt: p.lastFailAt != null ? Number(p.lastFailAt) : null,
    }
  } catch {
    return { total: 0, ok: 0, fail: 0, lastFailUrl: null, lastFailStatus: null, lastFailAt: null }
  }
}

function write(s: GrandmaFetchStats) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function recordGrandmaApiFetch(url: string, responseOk: boolean, httpStatus: number) {
  const s = read()
  s.total += 1
  if (responseOk && httpStatus >= 200 && httpStatus < 300) {
    s.ok += 1
  } else {
    s.fail += 1
    s.lastFailUrl = url
    s.lastFailStatus = httpStatus
    s.lastFailAt = Date.now()
  }
  write(s)
}

export function getGrandmaFetchStats(): GrandmaFetchStats {
  return read()
}

/** Success rate 0–100, or null if no requests yet. */
export function getGrandmaFetchSuccessRate(): number | null {
  const s = read()
  if (s.total <= 0) return null
  return Math.round((s.ok / s.total) * 1000) / 10
}

export function resetGrandmaFetchStats() {
  write({ total: 0, ok: 0, fail: 0, lastFailUrl: null, lastFailStatus: null, lastFailAt: null })
}

export function shouldTrackGrandmaFetch(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false
    const u = new URL(url, window.location.origin)
    return u.pathname.startsWith("/api")
  } catch {
    return false
  }
}
