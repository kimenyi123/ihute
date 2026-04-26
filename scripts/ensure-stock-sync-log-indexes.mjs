/**
 * One-shot: create indexes (and optional TTL) on stock_sync_events.
 *
 * Usage: MONGO_URI="mongodb://..." node scripts/ensure-stock-sync-log-indexes.mjs
 *
 * Optional: MONGO_DATABASE (default ihute_ops), MONGO_COLLECTION (default stock_sync_events),
 * STOCK_SYNC_LOG_TTL_SECONDS — if set (e.g. 7776000 for 90 days), creates a TTL index on createdAt.
 */
import { MongoClient } from "mongodb"

const uri = (process.env.MONGO_URI || "").trim()
const dbName = (process.env.MONGO_DATABASE || "ihute_ops").trim()
const collName = (process.env.MONGO_COLLECTION || "stock_sync_events").trim()
const ttlSecRaw = (process.env.STOCK_SYNC_LOG_TTL_SECONDS || "").trim()

async function main() {
  if (!uri) {
    console.error("Missing MONGO_URI")
    process.exit(1)
  }
  const client = new MongoClient(uri)
  await client.connect()
  try {
    const col = client.db(dbName).collection(collName)
    await col.createIndex({ createdAt: -1 })
    await col.createIndex({ ishyigaAccount: 1, createdAt: -1 })
    await col.createIndex({ stage: 1, createdAt: -1 })
    console.log("Created compound/list indexes on", dbName + "." + collName)

    if (ttlSecRaw) {
      const sec = Number.parseInt(ttlSecRaw, 10)
      if (!Number.isFinite(sec) || sec < 60) {
        console.error("Invalid STOCK_SYNC_LOG_TTL_SECONDS:", ttlSecRaw)
        process.exit(1)
      }
      const ttlName = "createdAt_ttl"
      try {
        await col.dropIndex(ttlName)
      } catch {
        /* none */
      }
      await col.createIndex({ createdAt: 1 }, { name: ttlName, expireAfterSeconds: sec })
      console.log("TTL index", ttlName, "expireAfterSeconds=", sec)
    } else {
      console.log("Skip TTL (set STOCK_SYNC_LOG_TTL_SECONDS to enable, e.g. 7776000 for 90 days)")
    }
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
