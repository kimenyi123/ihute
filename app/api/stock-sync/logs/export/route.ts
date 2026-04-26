import { NextRequest, NextResponse } from "next/server"
import { getStockSyncMongoClient } from "@/lib/mongo-stock-sync-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MONGO_URI = process.env.MONGO_URI?.trim() || ""
const MONGO_DATABASE = process.env.MONGO_DATABASE?.trim() || "ihute_ops"
const MONGO_COLLECTION = process.env.MONGO_COLLECTION?.trim() || "stock_sync_events"

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  if (!MONGO_URI) {
    return NextResponse.json({ ok: false, error: "MONGO_URI is required for CSV export." }, { status: 503 })
  }

  const sp = req.nextUrl.searchParams
  const seller = (sp.get("seller") || "").trim()
  const stage = (sp.get("stage") || "").trim()
  const status = (sp.get("status") || "").trim()
  const source = (sp.get("source") || "").trim()
  const from = (sp.get("from") || "").trim()
  const to = (sp.get("to") || "").trim()
  const maxRaw = Number.parseInt(sp.get("max") || "5000", 10)
  const max = Number.isFinite(maxRaw) ? Math.min(20000, Math.max(1, maxRaw)) : 5000

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

  try {
    const client = await getStockSyncMongoClient()
    if (!client) {
      return NextResponse.json({ ok: false, error: "Could not connect to MongoDB." }, { status: 502 })
    }
    const col = client.db(MONGO_DATABASE).collection(MONGO_COLLECTION)
    const docs = await col.find(filter).sort({ createdAt: -1 }).limit(max).toArray()

    const header = [
      "createdAt",
      "ishyigaAccount",
      "sellerOwner",
      "stage",
      "status",
      "source",
      "inputCount",
      "savedCount",
      "failedCount",
      "message",
      "redisKey",
    ]

    const lines = [header.join(",")]
    for (const d of docs) {
      const row = [
        d?.createdAt ?? "",
        d?.ishyigaAccount ?? "",
        d?.sellerOwner ?? "",
        d?.stage ?? "",
        d?.status ?? "",
        d?.source ?? "",
        d?.inputCount ?? "",
        d?.savedCount ?? "",
        d?.failedCount ?? "",
        d?.message ?? "",
        d?.redisKey ?? "",
      ]
      lines.push(row.map(csvCell).join(","))
    }

    const csv = lines.join("\n")
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stock-sync-logs-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}

