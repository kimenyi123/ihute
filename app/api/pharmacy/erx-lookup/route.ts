import { NextRequest, NextResponse } from "next/server"

import { getMohErxConfigFromEnv } from "@/lib/erx/moh-erx-config"
import { fetchMohErxByCode } from "@/lib/erx/moh-erx-client"
import { matchErxIdentity } from "@/lib/erx/erx-identity-match"
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
  const code = (req.nextUrl.searchParams.get("code") || "").trim()
  if (!code) {
    return NextResponse.json({ ok: false, code: "ERX_CODE_REQUIRED" }, { status: 400 })
  }

  const cfg = getMohErxConfigFromEnv()
  if (!cfg) {
    return NextResponse.json({ ok: false, code: "ERX_NOT_CONFIGURED" }, { status: 503 })
  }

  const ip = getClientIp(req)
  const rateLimitKey = `erx-lookup:${ip}:${code}`
  if (!allowSlidingWindow(rateLimitKey, 1, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ ok: false, code: "ERX_RATE_LIMITED" }, { status: 429 })
  }

  const phone = req.nextUrl.searchParams.get("phone") || ""
  const names = req.nextUrl.searchParams.get("names") || ""
  const nationalId = req.nextUrl.searchParams.get("nationalId") || ""

  if (!phone.trim() && !names.trim() && !nationalId.trim()) {
    return NextResponse.json({ ok: false, code: "ERX_UNLOCK_REQUIRED" }, { status: 400 })
  }

  const fetched = await fetchMohErxByCode(code, cfg)
  if (!fetched.ok) {
    if (fetched.error.kind === "not_found") {
      return NextResponse.json({ ok: false, code: "ERX_NOT_FOUND" }, { status: 404 })
    }
    console.error("[erx-lookup]", code, fetched.error)
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

  return NextResponse.json({
    ok: true,
    code,
    patientDisplayName: fetched.value.patient.fullName,
    drugs: fetched.value.drugs,
  })
}
