/**
 * Quick smoke test for stock sync Mongo config.
 *
 * Usage:
 *   MONGO_URI="mongodb://..." node scripts/test-stock-sync-mongo.mjs
 * Optional:
 *   MONGO_DATABASE=ihute_ops
 *   MONGO_COLLECTION=stock_sync_events
 */
import { MongoClient } from "mongodb"

const uri = (process.env.MONGO_URI || "").trim()
const dbName = (process.env.MONGO_DATABASE || "ihute_ops").trim()
const collName = (process.env.MONGO_COLLECTION || "stock_sync_events").trim()

async function main() {
  if (!uri) {
    console.error("Missing MONGO_URI")
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const ping = await client.db("admin").command({ ping: 1 })
    const col = client.db(dbName).collection(collName)
    const count = await col.countDocuments({})
    const latest = await col.find({}).sort({ createdAt: -1 }).limit(1).toArray()
    console.log("Ping:", ping?.ok === 1 ? "ok" : ping)
    console.log("DB:", dbName, "Collection:", collName)
    console.log("Documents:", count)
    console.log("Latest exists:", latest.length > 0 ? "yes" : "no")
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error("Mongo smoke test failed:", e?.message || e)
  process.exit(1)
})
