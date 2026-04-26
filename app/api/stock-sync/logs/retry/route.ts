import { NextResponse } from "next/server"
import { getRedis } from "@/lib/redis.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RetryBody = {
  ishyigaAccount?: string
  redisKey?: string
  stage?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RetryBody
  const stage = (body.stage || "").trim()
  const seller = (body.ishyigaAccount || "").trim()
  const providedKey = (body.redisKey || "").trim()
  const redisKey = providedKey || (seller ? `supplier_${seller}` : "")

  if (!redisKey) {
    return NextResponse.json({ ok: false, error: "Missing redisKey or ishyigaAccount." }, { status: 400 })
  }

  if (stage === "redis_ingest") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cannot retry send_to_redis from logs alone. Re-send the original payload to Redisbulk endpoint.",
      },
      { status: 400 },
    )
  }

  const redis = getRedis()
  if (!redis) {
    return NextResponse.json(
      { ok: false, error: "Redis is not configured on this Next.js server (REDIS_URL)." },
      { status: 503 },
    )
  }

  try {
    await redis.connect().catch(() => undefined)
    const current = await redis.get(redisKey)
    if (current == null) {
      return NextResponse.json(
        { ok: false, error: `Redis key not found: ${redisKey}` },
        { status: 404 },
      )
    }
    // Requeue by writing same payload back; sync job will pick this key on next run.
    await redis.set(redisKey, current)
    return NextResponse.json({
      ok: true,
      message: "Requeued in Redis. Wait for redis_to_mysql_sync scheduler run.",
      redisKey,
      bytes: current.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}

