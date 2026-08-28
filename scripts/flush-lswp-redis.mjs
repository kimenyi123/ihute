import fs from "node:fs"
import Redis from "ioredis"

function readEnvFile(path) {
  const out = {}
  if (!fs.existsSync(path)) return out
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const env = { ...readEnvFile(".env.local"), ...readEnvFile("kaos/.env"), ...process.env }

if (!env.REDIS_PASSWORD && fs.existsSync("kaos/.env")) {
  // kaos/.env may already be merged; also parse deployed hinduka if needed
}
const hindukaPath =
  "C:/Users/kimai/OneDrive/Documents/10/IHUTE_BCND/apache-tomcat-10.1.52/webapps/trading_ai/img/hinduka.txt"
if (!env.REDIS_PASSWORD && fs.existsSync(hindukaPath)) {
  const xml = fs.readFileSync(hindukaPath, "utf8")
  const m = xml.match(/<redis_password>([^<]+)<\/redis_password>/)
  if (m) env.REDIS_PASSWORD = m[1]
  const ip = xml.match(/<redis_server_ip>([^<]+)<\/redis_server_ip>/)
  if (ip) env.REDIS_HOST = ip[1]
}

const redis = new Redis({
  host: env.REDIS_HOST || "64.225.66.239",
  port: Number(env.REDIS_PORT || 6379),
  password: env.REDIS_PASSWORD || "",
  connectTimeout: 8000,
})

const patterns = ["LSWP:*", "SECTOR_STATS:*", "lswp:*"]
let total = 0
for (const pattern of patterns) {
  let cursor = "0"
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200)
    cursor = next
    if (keys.length) {
      await redis.del(...keys)
      total += keys.length
      console.log("deleted", keys.length, "keys for", pattern, keys.slice(0, 3))
    }
  } while (cursor !== "0")
}

// Also scan common prefix from Java code
const prefix = "list_suppliers_products:"
let cursor2 = "0"
do {
  const [next, keys] = await redis.scan(cursor2, "MATCH", prefix + "*", "COUNT", 200)
  cursor2 = next
  if (keys.length) {
    await redis.del(...keys)
    total += keys.length
    console.log("deleted prefix keys", keys)
  }
} while (cursor2 !== "0")

console.log("total deleted", total)
await redis.quit()
