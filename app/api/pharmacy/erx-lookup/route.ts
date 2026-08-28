import { NextRequest, NextResponse } from "next/server"

import { getMohErxConfigFromEnv } from "@/lib/erx/moh-erx-config"
import { fetchMohErxByCode } from "@/lib/erx/moh-erx-client"
import { matchErxIdentity } from "@/lib/erx/erx-identity-match"
import { insertErxTracking, maskUnlockHint } from "@/lib/erx/erx-tracking"
import { getClientIp, allowSlidingWindow } from "@/lib/ip-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 5 * 60_000

/**
 * Looks up a Ministry of Health eRx by code and validates the patient's
 * phone/names/national ID (from the "Fungura eRx" form) against the MOH
 * record before returning the prescribed drugs. A bare code alone never
 * returns drug data — identity match is required (see erx-identity-match.ts).
 */
export async function GET(req: NextRequest) {
  const requestedAt = new Date()
  const code = (req.nextUrl.searchParams.get("code") || "").trim()
  const clientIp = getClientIp(req)
  const userAgent = req.headers.get("user-agent") || ""

  const trackFail = async (failCode: string, failMessage?: string, extra?: Record<string, unknown>) => {
    const respondedAt = new Date()
    const { type, hint } = maskUnlockHint({
      phone: req.nextUrl.searchParams.get("phone") || "",
      names: req.nextUrl.searchParams.get("names") || "",
      nationalId: req.nextUrl.searchParams.get("nationalId") || "",
    })
    void insertErxTracking({
      eventType: "LOOKUP",
      erxCode: code || "—",
      status: "FAIL",
      failCode,
      failMessage,
      unlockKeyType: type,
      unlockKeyHint: hint,
      requestedAt,
      respondedAt,
      serviceStage: "UNLOCK",
      clientIp,
      userAgent,
      meta: extra,
    })
  }

  if (!code) {
    await trackFail("ERX_CODE_REQUIRED")
    return NextResponse.json({ ok: false, code: "ERX_CODE_REQUIRED" }, { status: 400 })
  }

  const cfg = getMohErxConfigFromEnv()
  if (!cfg) {
    await trackFail("ERX_NOT_CONFIGURED")
    return NextResponse.json({ ok: false, code: "ERX_NOT_CONFIGURED" }, { status: 503 })
  }

  const ip = clientIp
  const rateLimitKey = `erx-lookup:${ip}:${code}`
  if (!allowSlidingWindow(rateLimitKey, 1, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    await trackFail("ERX_RATE_LIMITED")
    return NextResponse.json({ ok: false, code: "ERX_RATE_LIMITED" }, { status: 429 })
  }

  const phone = req.nextUrl.searchParams.get("phone") || ""
  const names = req.nextUrl.searchParams.get("names") || ""
  const nationalId = req.nextUrl.searchParams.get("nationalId") || ""
  const { type: unlockKeyType, hint: unlockKeyHint } = maskUnlockHint({ phone, names, nationalId })

  if (!phone.trim() && !names.trim() && !nationalId.trim()) {
    await trackFail("ERX_UNLOCK_REQUIRED")
    return NextResponse.json({ ok: false, code: "ERX_UNLOCK_REQUIRED" }, { status: 400 })
  }

  const fetched = await fetchMohErxByCode(code, cfg)
  if (!fetched.ok) {
    if (fetched.error.kind === "not_found") {
      await trackFail("ERX_NOT_FOUND", fetched.error.message)
      return NextResponse.json({ ok: false, code: "ERX_NOT_FOUND" }, { status: 404 })
    }
    console.error("[erx-lookup]", code, fetched.error)
    await trackFail("ERX_UPSTREAM_ERROR", fetched.error.message)
    return NextResponse.json({ ok: false, code: "ERX_UPSTREAM_ERROR" }, { status: 502 })
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[erx-lookup] form input:", { phone, names, nationalId })
    console.log("[erx-lookup] MOH patient record:", fetched.value.patient)
  }

  const match = matchErxIdentity({ phone, names, nationalId }, fetched.value.patient)

  if (process.env.NODE_ENV !== "production") {
    console.log("[erx-lookup] match result:", match)
  }

  if (!match.unlocked) {
    const respondedAt = new Date()
    void insertErxTracking({
      eventType: "LOOKUP",
      erxCode: code,
      status: "FAIL",
      failCode: "ERX_IDENTITY_MISMATCH",
      unlockKeyType,
      unlockKeyHint,
      requestedAt,
      respondedAt,
      serviceStage: "UNLOCK",
      clientIp,
      userAgent,
      meta: {
        matchedFields: match.matchedFields,
        failedFields: match.failedFields,
      },
    })
    return NextResponse.json(
      {
        ok: false,
        code: "ERX_IDENTITY_MISMATCH",
        matchedFields: match.matchedFields,
        providedFields: match.providedFields,
        failedFields: match.failedFields,
      },
      { status: 403 },
    )
  }

  const respondedAt = new Date()
  void insertErxTracking({
    eventType: "LOOKUP",
    erxCode: code,
    status: "SUCCESS",
    unlockKeyType,
    unlockKeyHint,
    requestedAt,
    respondedAt,
    patientDisplayName: fetched.value.patient.fullName,
    drugCount: fetched.value.drugs.length,
    drugsJson: fetched.value.drugs,
    serviceStage: "UNLOCK",
    clientIp,
    userAgent,
  })

  return NextResponse.json({
    ok: true,
    code,
    patientDisplayName: fetched.value.patient.fullName,
    drugs: fetched.value.drugs,
  })
}
