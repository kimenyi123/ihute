import { NextRequest, NextResponse } from "next/server"
import { getStockSyncMongoClient } from "@/lib/mongo-stock-sync-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MONGO_URI = process.env.MONGO_URI?.trim() || ""
const MONGO_DATA_API_URL = process.env.MONGO_DATA_API_URL?.trim() || ""
const MONGO_DATA_API_KEY = process.env.MONGO_DATA_API_KEY?.trim() || ""
const MONGO_DATA_SOURCE = process.env.MONGO_DATA_SOURCE?.trim() || ""
const MONGO_DATABASE = process.env.MONGO_DATABASE?.trim() || "ihute_ops"
const MONGO_COLLECTION = process.env.MONGO_COLLECTION?.trim() || "stock_sync_events"

function isDataApiConfigured() {
  return Boolean(MONGO_DATA_API_URL && MONGO_DATA_API_KEY && MONGO_DATA_SOURCE)
}

function isConfigured() {
  return Boolean(MONGO_URI || isDataApiConfigured())
}

/** BSON-friendly JSON for API responses (ObjectId → hex string). */
function leanValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v !== "object") return v
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(leanValue)
  const maybeHex = v as { toHexString?: () => string }
  if (typeof maybeHex.toHexString === "function") {
    return maybeHex.toHexString()
  }
  if (Object.getPrototypeOf(v) === Object.prototype) {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) {
      out[k] = leanValue(val)
    }
    return out
  }
  return String(v)
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mongo is not configured. Set MONGO_URI, or set MONGO_DATA_API_URL, MONGO_DATA_API_KEY, and MONGO_DATA_SOURCE.",
      },
      { status: 503 },
    )
  }

  const sp = req.nextUrl.searchParams
  const seller = (sp.get("seller") || "").trim()
  const stage = (sp.get("stage") || "").trim()
  const status = (sp.get("status") || "").trim()
  const source = (sp.get("source") || "").trim()
  const from = (sp.get("from") || "").trim()
  const to = (sp.get("to") || "").trim()
  const pageRaw = Number.parseInt(sp.get("page") || "1", 10)
  const pageSizeRaw = Number.parseInt(sp.get("pageSize") || sp.get("limit") || "10", 10)
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(200, Math.max(1, pageSizeRaw)) : 25
  const skip = (page - 1) * pageSize

  const filter: Record<string, unknown> = {}
  if (seller) filter.ishyigaAccount = seller
  if (stage) filter.stage = stage
  if (status) filter.status = status
  if (source) filter.source = source
  if (from || to) {
    const createdAt: Record<string, string> = {}
    if (from) createdAt.$gte = from
    if (to) createdAt.$lte = to
    filter.createdAt = createdAt
  }

  if (MONGO_URI) {
    try {
      const client = await getStockSyncMongoClient()
      if (!client) {
        return NextResponse.json(
          { ok: false, error: "Could not connect to MongoDB." },
          { status: 502 },
        )
      }
      const col = client.db(MONGO_DATABASE).collection(MONGO_COLLECTION)
      const total = await col.countDocuments(filter)
      const docs = await col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray()
      const items = docs.map((d) => leanValue(d) as Record<string, unknown>)
      const summaryRows = await col
        .aggregate<{ _id: string; events: number; accounts: string[] }>([
          { $match: filter },
          {
            $group: {
              _id: { $ifNull: ["$stage", "unknown"] },
              events: { $sum: 1 },
              accounts: { $addToSet: { $ifNull: ["$ishyigaAccount", ""] } },
            },
          },
        ])
        .toArray()

      const uniqueAccountsByStage: Record<string, number> = {}
      const eventsByStage: Record<string, number> = {}
      let uniqueAccountsTotal = 0
      const uniqueAll = new Set<string>()
      for (const row of summaryRows) {
        const stageKey = row._id || "unknown"
        const accounts = Array.isArray(row.accounts) ? row.accounts.filter(Boolean) : []
        uniqueAccountsByStage[stageKey] = accounts.length
        eventsByStage[stageKey] = row.events || 0
        for (const acc of accounts) uniqueAll.add(acc)
      }
      uniqueAccountsTotal = uniqueAll.size

      return NextResponse.json({
        ok: true,
        items,
        count: items.length,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        summary: {
          uniqueAccountsTotal,
          uniqueAccountsByStage,
          eventsByStage,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      return NextResponse.json({ ok: false, error: msg }, { status: 502 })
    }
  }

  const body = {
    dataSource: MONGO_DATA_SOURCE,
    database: MONGO_DATABASE,
    collection: MONGO_COLLECTION,
    filter,
    sort: { createdAt: -1 },
    limit: pageSize,
    skip,
  }

  try {
    const res = await fetch(`${MONGO_DATA_API_URL}/action/find`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": MONGO_DATA_API_KEY,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const json = (await res.json().catch(() => ({}))) as {
      documents?: unknown[]
      error?: string
      error_code?: string
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error || "Mongo Data API request failed." },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      items: Array.isArray(json.documents) ? json.documents : [],
      count: Array.isArray(json.documents) ? json.documents.length : 0,
      total: Array.isArray(json.documents) ? json.documents.length : 0,
      page,
      pageSize,
      totalPages: 1,
      summary: {
        uniqueAccountsTotal: 0,
        uniqueAccountsByStage: {},
        eventsByStage: {},
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
