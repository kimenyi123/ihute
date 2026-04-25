import { MongoClient } from "mongodb"

const uri = process.env.MONGO_URI?.trim() || ""

type GlobalMongo = typeof globalThis & {
  __stockSyncMongoConnect?: Promise<MongoClient>
}

/**
 * Reuses one connected {@link MongoClient} per Node process (HMR-safe via globalThis).
 */
export async function getStockSyncMongoClient(): Promise<MongoClient | null> {
  if (!uri) return null
  const g = globalThis as GlobalMongo
  if (!g.__stockSyncMongoConnect) {
    const client = new MongoClient(uri)
    g.__stockSyncMongoConnect = client.connect().then(() => client)
  }
  try {
    return await g.__stockSyncMongoConnect
  } catch {
    g.__stockSyncMongoConnect = undefined
    return null
  }
}
