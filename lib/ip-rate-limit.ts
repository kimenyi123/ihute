/**
 * Simple in-memory sliding-window rate limiter (per process).
 * Suitable for single-instance Next.js; resets on deploy/restart.
 */

type WindowState = { timestamps: number[] }

const buckets = new Map<string, WindowState>()

/** Prune stale buckets occasionally to avoid unbounded memory growth. */
let lastPrune = Date.now()
const PRUNE_EVERY_MS = 5 * 60_000

function pruneStale(now: number, windowMs: number) {
  if (now - lastPrune < PRUNE_EVERY_MS) return
  lastPrune = now
  for (const [key, state] of buckets) {
    state.timestamps = state.timestamps.filter((t) => now - t < windowMs)
    if (state.timestamps.length === 0) buckets.delete(key)
  }
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for")
  if (xf) {
    const first = xf.split(",")[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  return "unknown"
}

/**
 * @returns true if `count` new events are allowed for this key within the window.
 */
export function allowSlidingWindow(
  key: string,
  count: number,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  pruneStale(now, windowMs)
  let state = buckets.get(key)
  if (!state) {
    state = { timestamps: [] }
    buckets.set(key, state)
  }
  state.timestamps = state.timestamps.filter((t) => now - t < windowMs)
  if (state.timestamps.length + count > limit) {
    return false
  }
  for (let i = 0; i < count; i++) {
    state.timestamps.push(now)
  }
  return true
}
