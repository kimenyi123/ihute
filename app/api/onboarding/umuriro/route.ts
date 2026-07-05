import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"
import { isValidRwandaMobileE164, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"
import { sendSms } from "@/lib/sms/send-sms"
import { buildUmuriroSellerSmsBodyFromLines } from "@/lib/umuriro-seller-sms"

/**
 * Umuriro: minimal “shop contact + purchase line + MoMo USSD” payload.
 * Persists to `shop_onboarding_draft` when ONBOARDING_MYSQL_* is set (Quick + Advanced).
 * SMS audit → `umuriro_sms_outbound` when table exists (optional; does not block save).
 * When `shop.shopPhoneOptional` is a valid Rwandan mobile, sends SMS to that seller (Twilio or SMS_WEBHOOK_URL).
 */

async function persistPayload(body: unknown): Promise<void> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    throw new Error("ONBOARDING_MYSQL_* is not configured")
  }

  const conn = await mysql.createConnection(cfg)
  try {
    await conn.query("INSERT INTO shop_onboarding_draft (payload_json) VALUES (?)", [
      JSON.stringify(body),
    ])
  } finally {
    await conn.end()
  }
}

async function logSmsOutbound(params: {
  requestId: string
  toE164: string | null
  sentOk: boolean
  provider?: string
  errorMessage?: string
  smsBody?: string
}): Promise<void> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) return

  const conn = await mysql.createConnection(cfg)
  try {
    await conn.query(
      `INSERT INTO umuriro_sms_outbound
         (request_id, to_e164, sent_ok, provider, error_message, sms_body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.requestId,
        params.toE164,
        params.sentOk ? 1 : 0,
        params.provider ?? null,
        params.errorMessage?.slice(0, 512) ?? null,
        params.smsBody ?? null,
      ],
    )
  } finally {
    await conn.end()
  }
}

export type UmuriroPayload = {
  kind: "umuriro"
  /** `quick` = minimal line; `advanced` = category + catalog search + track dialog. */
  umuriroMode?: "quick" | "advanced"
  incompleteSeller: true
  savedBy: { email: string; name: string; phone: string }
  /** Creator + reserved 100 RWF ledger line (discount or fee — product rules). */
  policy?: {
    createdBy: { email: string; name: string; phone: string }
    adjustmentRwf: number
  }
  shop: {
    companyName: string
    momoCode: string
    momoDigits: string
    shopPhoneOptional?: string
    shopCategory?: string
    sectorSlug?: string
  }
  line: {
    itemName: string
    unitPriceRwf: number
    quantity: number
    totalRwf: number
  }
  /** Multi-item cart (Quick + Advanced). When set, `line` mirrors first row for older readers. */
  lines?: Array<{
    itemName: string
    itemCode?: string
    unitPriceRwf: number
    quantity: number
    lineTotalRwf: number
  }>
  ussd: string
  submittedAt: string
  rid?: string
  payment?: {
    channel: "momo" | "cash"
    momoSmsMatched: boolean | null
  }
}

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  try {
    const body = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON", rid }, { status: 400 })
    }

    const record = body as Record<string, unknown>
    if (record.kind !== "umuriro") {
      return NextResponse.json({ ok: false, error: "Expected kind: umuriro", rid }, { status: 400 })
    }

    const enriched = { ...record, rid }
    const mysqlConfigured = Boolean(getOnboardingMysqlConfig())

    if (mysqlConfigured) {
      try {
        await persistPayload(enriched)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[umuriro ${rid}] draft insert failed:`, msg)
        return NextResponse.json(
          {
            ok: false,
            error: `Database save failed: ${msg}`,
            rid,
            persisted: false,
          },
          { status: 503 },
        )
      }
    } else {
      console.log(`[umuriro ${rid}] No ONBOARDING_MYSQL_* — echo only (set env to persist)`)
    }

    const shop = record.shop as Record<string, unknown> | undefined
    const line = record.line as Record<string, unknown> | undefined
    const linesRaw = record.lines
    const lineNames: string[] = []
    if (Array.isArray(linesRaw)) {
      for (const row of linesRaw) {
        if (row && typeof row === "object" && typeof (row as { itemName?: unknown }).itemName === "string") {
          const n = (row as { itemName: string }).itemName.trim()
          if (n) lineNames.push(n)
        }
      }
    }
    const rawPhone =
      typeof shop?.shopPhoneOptional === "string" ? shop.shopPhoneOptional.trim() : ""
    const itemName =
      lineNames.length > 0
        ? lineNames.join(", ")
        : typeof line?.itemName === "string"
          ? line.itemName
          : ""

    let sms: {
      attempted: boolean
      sent: boolean
      reason?: string
      to?: string
    } = { attempted: false, sent: false }
    let smsPreview: string | undefined

    if (rawPhone) {
      const e164 = normalizeRwandaMobileE164(rawPhone)
      if (e164 && isValidRwandaMobileE164(e164)) {
        sms.attempted = true
        sms.to = e164
        const text = buildUmuriroSellerSmsBodyFromLines(
          lineNames.length > 0 ? lineNames : itemName ? [itemName] : [],
          rid,
        )
        smsPreview = text
        const out = await sendSms(e164, text)
        sms.sent = out.ok
        if (!out.ok) {
          sms.reason = out.error || "send failed"
          console.warn(`[umuriro ${rid}] SMS not sent:`, out.error)
        }
        try {
          await logSmsOutbound({
            requestId: rid,
            toE164: e164,
            sentOk: out.ok,
            provider: out.provider,
            errorMessage: out.error,
            smsBody: text,
          })
        } catch (e: unknown) {
          console.warn(`[umuriro ${rid}] sms audit insert:`, (e as Error)?.message || e)
        }
      } else {
        sms.attempted = false
        sms.reason = "invalid_rwanda_phone"
      }
    }

    const persisted = mysqlConfigured

    return NextResponse.json({
      ok: true,
      rid,
      persisted,
      sms,
      smsPreview,
      message: persisted
        ? "Order saved to shop_onboarding_draft."
        : "Received (echo). Set ONBOARDING_MYSQL_* + shop_onboarding_draft to persist.",
    })
  } catch (e: unknown) {
    console.error(`[umuriro ${rid}]`, e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "error", rid }, { status: 500 })
  }
}
