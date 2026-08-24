import { NextResponse } from "next/server"
import { isValidRwandaMobileE164, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"
import {
  isOnboardingMysqlConfigured,
  logUmuriroSmsOutbound,
  persistShopOnboardingDraft,
} from "@/lib/onboarding-draft-persist"
import { sendSms } from "@/lib/sms/send-sms"
import { buildUmuriroSellerSmsBodyFromLines } from "@/lib/umuriro-seller-sms"

/**
 * Umuriro: minimal “shop contact + purchase line + MoMo USSD” payload.
 * Persists to `shop_onboarding_draft` before reporting success (Quick + Advanced).
 * SMS audit → `umuriro_sms_outbound` (best-effort; does not block save).
 */

export type UmuriroPayload = {
  kind: "umuriro"
  umuriroMode?: "quick" | "advanced"
  incompleteSeller: true
  savedBy: { email: string; name: string; phone: string }
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
    momoTxId?: string | null
  }
}

function friendlyDbError(raw: string, shopName: string): string {
  const shop = shopName.trim() || "order"
  if (/ER_NO_SUCH_TABLE|doesn't exist/i.test(raw)) {
    return `Quick Shop: could not save "${shop}" — database table missing (contact admin).`
  }
  if (/Invalid JSON|JSON/i.test(raw)) {
    return `Quick Shop: could not save "${shop}" — invalid order data.`
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect/i.test(raw)) {
    return `Quick Shop: could not save "${shop}" — database unreachable.`
  }
  if (/ONBOARDING_MYSQL/i.test(raw)) {
    return `Quick Shop: database not configured on server.`
  }
  return `Quick Shop: could not save "${shop}". Try again or contact support.`
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

    const shop = record.shop as Record<string, unknown> | undefined
    const shopName = typeof shop?.companyName === "string" ? shop.companyName : ""
    const enriched = { ...record, rid }
    const mysqlConfigured = isOnboardingMysqlConfigured()

    if (!mysqlConfigured) {
      return NextResponse.json(
        {
          ok: false,
          error: "ONBOARDING_MYSQL_* is not configured on the server. Cannot save order.",
          rid,
          persisted: false,
        },
        { status: 503 },
      )
    }

    try {
      await persistShopOnboardingDraft(enriched)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[umuriro ${rid}] draft insert failed:`, msg)
      return NextResponse.json(
        {
          ok: false,
          error: friendlyDbError(msg, shopName),
          rid,
          persisted: false,
        },
        { status: 503 },
      )
    }

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
        void logUmuriroSmsOutbound({
          requestId: rid,
          toE164: e164,
          sentOk: out.ok,
          provider: out.provider,
          errorMessage: out.error,
          smsBody: text,
        })
      } else {
        sms.attempted = false
        sms.reason = "invalid_rwanda_phone"
      }
    }

    return NextResponse.json({
      ok: true,
      rid,
      persisted: true,
      sms,
      smsPreview,
      message: "Order saved to shop_onboarding_draft.",
    })
  } catch (e: unknown) {
    console.error(`[umuriro ${rid}]`, e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "error", rid }, { status: 500 })
  }
}
