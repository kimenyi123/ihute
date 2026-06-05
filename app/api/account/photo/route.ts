import { NextRequest, NextResponse } from "next/server"
import { getAccountProfileUrl, getProxyTimeoutMs } from "@/lib/backend-config"

const PROXY_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

/**
 * POST /api/account/photo
 * Multipart: account, file — saves shop logo to Kaos WAR and account_seller.photo.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const account = String(form.get("account") || "").trim()
  const file = form.get("file")

  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Only image files are allowed" }, { status: 400 })
  }

  const outFd = new FormData()
  outFd.append("account", account)
  outFd.append("file", file, file.name || "shop-photo")

  const url = getAccountProfileUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: "POST",
      body: outFd,
      cache: "no-store",
      signal: controller.signal,
    })
    const text = await res.text()
    let data: { ok?: boolean; photo?: string; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { ok: false, error: "Backend returned invalid JSON", fromBackend: true },
        { status: 502 }
      )
    }
    if (!res.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || `Backend ${res.status}`, fromBackend: true },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }
    return NextResponse.json({ ok: true, photo: data.photo || "" })
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string }
    if (err?.name === "AbortError") {
      return NextResponse.json({ ok: false, error: "Backend timeout" }, { status: 504 })
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Backend unreachable" },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
