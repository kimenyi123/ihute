// lib/redis.server.ts
import type IORedis from "ioredis"
import Redis from "ioredis"

let client: IORedis | null = null
let loggedOnce = false

function logOnce(msg: string) {
  if (!loggedOnce) {
    console.log(msg)
    loggedOnce = true
  }
}

/**
 * Returns a singleton ioredis client or null if not configured.
 * - Only honors REDIS_URL or UPSTASH_REDIS_URL (redis/rediss).
 * - Explicitly ignores UPSTASH_REDIS_REST_URL (HTTP REST endpoint).
 * - Uses lazyConnect so no socket is opened until you actually call .connect()/.subscribe() etc.
 * - Disables offline queue to avoid command buffering when disconnected.
 */
export function getRedis(): IORedis | null {
  const url =
    process.env.REDIS_URL ||
    process.env.UPSTASH_REDIS_URL ||
    "" // don't consider UPSTASH_REDIS_REST_URL here

  // Not configured → cleanly disabled
  if (!url) {
    logOnce("[redis] disabled: no REDIS_URL / UPSTASH_REDIS_URL set")
    return null
  }

  // If someone set the REST URL by mistake, disable and warn
  if (url.startsWith("http://") || url.startsWith("https://")) {
    logOnce("[redis] disabled: provided URL looks like a REST endpoint (HTTP). Use redis:// or rediss://.")
    return null
  }

  if (client) return client

  client = new Redis(url, {
    // Don't auto-connect on construction
    lazyConnect: true,

    // ioredis defaults that reduce noise/backpressure when not connected
    enableReadyCheck: false,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,

    // Mild backoff if someone DOES call a command before connect()
    retryStrategy: (times) => Math.min(times * 200, 1500),
  })

  // Swallow internal client errors to avoid unhandled error spam
  client.on("error", () => {})
  return client
}

/**
 * Optional: a helper that returns a dedicated subscriber connection
 * or null if redis is not configured. Use this for pub/sub (SSE).
 */
export async function getRedisSubscriber(): Promise<IORedis | null> {
  const base = getRedis()
  if (!base) return null
  const sub = base.duplicate()
  // never throw here — let the caller decide when to connect/subscribe
  sub.on("error", () => {})
  return sub
}
