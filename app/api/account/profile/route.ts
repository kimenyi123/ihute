import { NextRequest, NextResponse } from "next/server"
import { getAccountProfileUrl, getProxyTimeoutMs } from "@/lib/backend-config"

const PROXY_TIMEOUT_MS = Math.max(10000, getProxyTimeoutMs())

/** Backend profile shape (account_signup). */
interface BackendProfile {
  firstName?: string
  lastName?: string
  email?: string
  tel?: string
  hqLocation?: string
  momo?: string
  currency?: string
  preferred_currency?: string
  description?: string
  nickname?: string
  ishyigaAccount?: string
  owner?: string
  businessName?: string
  businessCategory?: string
  preferredCategories?: string
  photo?: string
  clientId?: string
  [key: string]: unknown
}

/** Normalize backend profile to frontend User-like shape. */
function normalizeProfile(p: BackendProfile) {
  const firstName = (p.firstName ?? "").trim()
  const lastName = (p.lastName ?? "").trim()
  const name = [firstName, lastName].filter(Boolean).join(" ") || (p.owner ?? p.email ?? "")
  return {
    name,
    email: (p.email ?? "").trim(),
    phone: (p.tel ?? "").trim(),
    location: (p.hqLocation ?? "").trim(),
    momo: (p.momo ?? "").trim(),
    currency: (p.currency ?? p.preferred_currency ?? "").trim(),
    description: (p.description ?? "").trim(),
    nickname: (p.nickname ?? "").trim(),
    ishyigaAccount: (p.ishyigaAccount ?? "").trim(),
    owner: (p.owner ?? "").trim(),
    businessName: (p.businessName ?? "").trim(),
    businessCategory: (p.businessCategory ?? "").trim(),
    photo: (p.photo ?? "").trim(),
  }
}

/**
 * GET /api/account/profile?email=... | ?account=...
 * Proxies to backend account_signup profile. Backend should return { ok, profile: { ... } }.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim()
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!email && !account) {
    return NextResponse.json(
      { ok: false, error: "email or account required" },
      { status: 400 }
    )
  }

  const base = getAccountProfileUrl()
  const params = new URLSearchParams()
  if (email) params.set("email", email)
  if (account) params.set("account", account)
  const url = `${base}?${params.toString()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
    const text = await res.text()
    let data: { ok?: boolean; profile?: BackendProfile; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { ok: false, error: "Backend returned invalid JSON", fromBackend: true },
        { status: 502 }
      )
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || `Backend ${res.status}`, fromBackend: true },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }
    if (!data?.ok || !data.profile) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Profile not found", fromBackend: true },
        { status: 404 }
      )
    }
    return NextResponse.json({
      ok: true,
      profile: normalizeProfile(data.profile),
    })
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string }
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Backend timeout", fromBackend: false },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Backend unreachable", fromBackend: false },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * PUT /api/account/profile
 * Body: { email?: string, account?: string, name?, phone?, location?, momo?, currency?, description?, nickname?, ishyigaAccount?, owner?, businessName?, businessCategory? }
 * Proxies to backend to update account_signup.
 */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const account = typeof body.account === "string" ? body.account.trim() : ""
  if (!email && !account) {
    return NextResponse.json(
      { ok: false, error: "email or account required in body" },
      { status: 400 }
    )
  }

  const payload = {
    ...(email && { email }),
    ...(account && { account }),
    name: body.name,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    tel: body.tel,
    location: body.location,
    hqLocation: body.hqLocation,
    momo: body.momo,
    currency: body.currency,
    description: body.description,
    nickname: body.nickname,
    ishyigaAccount: body.ishyigaAccount,
    owner: body.owner,
    businessName: body.businessName,
    businessCategory: body.businessCategory,
  }

  const url = getAccountProfileUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    })
    const text = await res.text()
    let data: { ok?: boolean; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      if (res.ok) {
        return NextResponse.json({ ok: true })
      }
      return NextResponse.json(
        { ok: false, error: "Backend returned invalid JSON", fromBackend: true },
        { status: 502 }
      )
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || `Backend ${res.status}`, fromBackend: true },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }
    return NextResponse.json({ ok: data?.ok !== false, error: data?.error })
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string }
    if (err?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Backend timeout", fromBackend: false },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Backend unreachable", fromBackend: false },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
