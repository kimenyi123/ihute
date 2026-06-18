import { NextRequest, NextResponse } from "next/server"
import { getAccountProfileUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import { persistShopImageUpload } from "@/lib/shop-image-overrides"

export const runtime = "nodejs"

const PROXY_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

/**
 * POST /api/account/photo
 * Multipart: account, file — saves to Kaos WAR + account_seller.photo, and to Next.js
 * uploads/overrides so category cards on beta.ihute.rw can load the logo.
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

  const fileBuf = Buffer.from(await file.arrayBuffer())
  const fileName = file.name || "shop-photo"

  let nextImage: { imageUrl: string; storedPath: string } | null = null
  try {
    nextImage = await persistShopImageUpload(account, fileBuf, file.type, fileName)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not save shop image locally"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const outFd = new FormData()
  outFd.append("account", account)
  outFd.append("file", new Blob([fileBuf], { type: file.type }), fileName)

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
      return NextResponse.json({
        ok: true,
        photo: nextImage.imageUrl,
        imageUrl: nextImage.imageUrl,
        backendPhoto: "",
        backendOk: false,
        warning: "Backend returned invalid JSON; logo saved for category page only",
      })
    }
    if (!res.ok || !data?.ok) {
      return NextResponse.json({
        ok: true,
        photo: nextImage.imageUrl,
        imageUrl: nextImage.imageUrl,
        backendPhoto: "",
        backendOk: false,
        warning: data?.error || `Backend ${res.status}; logo saved for category page only`,
      })
    }
    return NextResponse.json({
      ok: true,
      photo: nextImage.imageUrl,
      imageUrl: nextImage.imageUrl,
      backendPhoto: data.photo || "",
      backendOk: true,
    })
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
