import { NextResponse } from "next/server"
import { getRedis } from "@/lib/redis.server"

const MAX_KEYS = 200
const MAX_STRING = 6000

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV === "development") return true
  const secret = process.env.REDIS_DEBUG_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}` || auth === secret
}

/** Dev / secret-protected Redis key listing (SCAN + GET for strings). */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({
      ok: false,
      error: "redis_not_configured",
      hint: "Set REDIS_URL or UPSTASH_REDIS_URL (redis:// or rediss://).",
      entries: [] as unknown[],
    })
  }

  try {
    await redis.connect()
  } catch {
    /* lazyConnect may already be connected */
  }

  const keys: string[] = []
  let cursor = "0"
  try {
    do {
      const [next, batch] = await redis.scan(cursor, "COUNT", 120)
      cursor = next
      keys.push(...batch)
      if (keys.length >= MAX_KEYS) break
    } while (cursor !== "0" && keys.length < MAX_KEYS)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "scan_failed", message: msg }, { status: 500 })
  }

  const slice = keys.slice(0, MAX_KEYS)
  const entries: {
    key: string
    type: string
    ttl: number
    value: string | null
  }[] = []

  for (const key of slice) {
    try {
      const type = await redis.type(key)
      const ttl = await redis.ttl(key)
      let value: string | null = null
      if (type === "string") {
        const v = await redis.get(key)
        if (v != null && v.length > MAX_STRING) {
          value = `${v.slice(0, MAX_STRING)}…`
        } else {
          value = v
        }
      } else {
        value = `[${type} — use redis-cli for large structures]`
      }
      entries.push({ key, type, ttl, value })
    } catch {
      entries.push({ key, type: "?", ttl: -2, value: "[read error]" })
    }
  }

  return NextResponse.json({ ok: true, count: entries.length, entries })
}
