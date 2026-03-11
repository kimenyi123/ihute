/**
 * Redis-first cache for API responses.
 * Used by fetchSuggestions, shop-with-me, supplier products, etc.
 * Flow: check Redis first → if miss, call backend (DB) → store in Redis → return.
 */
import { createHash } from "crypto"
import { getRedis } from "@/lib/redis.server"

const KEY_PREFIX = "ihute:api:"
const MAX_KEY_LEN = 200

/** Build a stable cache key from query params (and optional body). Long keys are hashed. */
export function buildCacheKey(prefix: string, params: Record<string, string>, body?: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&")
  const raw = body ? `${sorted}|body=${body}` : sorted
  const keyPart = raw.length > MAX_KEY_LEN ? createHash("sha256").update(raw).digest("hex") : raw
  return `${KEY_PREFIX}${prefix}:${keyPart}`
}

/** Get cached JSON string or null. Returns null if Redis disabled or error. */
export async function getCached(key: string): Promise<string | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const val = await redis.get(key)
    return val
  } catch {
    return null
  }
}

/** Set cache with TTL in seconds. No-op if Redis disabled or error. */
export async function setCached(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.setex(key, ttlSeconds, value)
  } catch {
    // ignore
  }
}

/** TTL for search/suggestions (5 min). */
export const SUGGESTIONS_TTL_SEC = Number(process.env.REDIS_CACHE_SUGGESTIONS_TTL_SEC) || 300

/** TTL for shop-with-me / supplier list (2 min). */
export const DATA_TTL_SEC = Number(process.env.REDIS_CACHE_DATA_TTL_SEC) || 120
