import { NextResponse } from "next/server"
import { getAccountProfileUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import { DEFAULT_GUEST_ISHYIGA_ACCOUNT, GUEST_POOL_EMAIL } from "@/lib/guest-checkout"
import { ensureGuestPoolRowInDb } from "@/lib/mysql-guest-pool"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIMEOUT_MS = Math.max(10000, getProxyTimeoutMs())

function extractIshyiga(profile: unknown): string {
  if (!profile || typeof profile !== "object") return ""
  const p = profile as Record<string, unknown>
  return String(p.ishyigaAccount ?? p.ISHYIGA_ACCOUNT ?? "").trim()
}

async function fetchProfileLookup(q: { account?: string; email?: string }): Promise<string | null> {
  const base = getAccountProfileUrl()
  const sp = new URLSearchParams()
  if (q.account) sp.set("account", String(q.account))
  if (q.email) sp.set("email", String(q.email))
  const url = `${base}?${sp.toString()}`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    })
    const text = await res.text()
    let data: { ok?: boolean; profile?: unknown; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return null
    }
    if (!res.ok || !data?.ok || !data.profile) return null
    const ish = extractIshyiga(data.profile)
    return ish || null
  } finally {
    clearTimeout(t)
  }
}

const poolEmail = GUEST_POOL_EMAIL
const poolAccount = DEFAULT_GUEST_ISHYIGA_ACCOUNT

/**
 * POST /api/account/ensure-guest-pool
 * 1) Prefer Java AccountProfile by email / IHUTE_GUEST account.
 * 2) If not found, MySQL: SELECT by guest_pool@ihute.rw; else INSERT with ISHYIGA_ACCOUNT starting with IHUTE_GUEST.
 */
export async function POST() {
  try {
    let ish = await fetchProfileLookup({ email: poolEmail })
    if (ish) {
      return NextResponse.json({ ok: true, ishyigaAccount: ish, source: "profile-email" })
    }

    ish = await fetchProfileLookup({ account: poolAccount })
    if (ish) {
      return NextResponse.json({ ok: true, ishyigaAccount: ish, source: "profile-account" })
    }

    const db = await ensureGuestPoolRowInDb()
    if (db.ok && db.ishyigaAccount) {
      ish =
        (await fetchProfileLookup({ email: poolEmail })) ||
        (await fetchProfileLookup({ account: db.ishyigaAccount })) ||
        (await fetchProfileLookup({ account: poolAccount }))

      return NextResponse.json({
        ok: true,
        ishyigaAccount: db.ishyigaAccount,
        source: ish ? "db-then-profile" : "db-only",
        inserted: db.inserted,
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: db.error || "Could not ensure guest pool row",
        hint: "Check lib/mysql-guest-pool.ts DB settings and account_signup columns.",
        poolEmail,
      },
      { status: 503 },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
