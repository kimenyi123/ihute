import { NextRequest, NextResponse } from "next/server"
import { getAccountProfileUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import {
  getAccountSellerPhoto,
  normalizePhotoColumnValue,
  updateAccountSellerPhoto,
} from "@/lib/account-seller-photo-db"
import { persistShopImageUpload } from "@/lib/shop-image-overrides"
import { shopImagePublicUrl } from "@/lib/image-upload-paths"
import { resolveSellerPhotoUrl } from "@/lib/seller-photo-url"
import { stableShopPhotoWebPath } from "@/lib/shop-photo-stable"

export const runtime = "nodejs"

const PROXY_TIMEOUT_MS = Math.max(30000, getProxyTimeoutMs())

/**
 * POST /api/account/photo
 * Multipart: account, file — saves image, stores public URL in account_seller.photo (chaos_beta).
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

  const ext = (() => {
    const byType = (file.type.split("/")[1] || "jpg").toLowerCase()
    if (byType === "jpeg" || byType === "png" || byType === "webp" || byType === "gif") return byType
    return "jpg"
  })()

  let stored: { fileName: string; imageUrl: string; storedPath: string; webPath: string }
  try {
    stored = await persistShopImageUpload(account, fileBuf, file.type, fileName)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not save shop image"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const photoDbValue = normalizePhotoColumnValue(stableShopPhotoWebPath(account, ext))
  const displayUrl = shopImagePublicUrl(stored.fileName)

  const dbUpdate = await updateAccountSellerPhoto(account, photoDbValue)

  let backendPhoto = ""
  let backendOk = false
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
    try {
      const data = JSON.parse(text) as { ok?: boolean; photo?: string }
      if (res.ok && data?.ok) {
        backendOk = true
        backendPhoto = String(data.photo || "").trim()
        // Keep DB on stable /img/shops/{account}.ext even if Java returns a legacy timestamp path.
        await updateAccountSellerPhoto(account, photoDbValue)
      }
    } catch {
      /* Java optional */
    }
  } catch {
    /* Java optional */
  } finally {
    clearTimeout(timeout)
  }

  if (!dbUpdate.ok) {
    if (backendOk && backendPhoto) {
      return NextResponse.json({
        ok: true,
        photo: backendPhoto,
        imageUrl: resolveSellerPhotoUrl(backendPhoto),
        dbSaved: false,
        backendOk: true,
        warning: dbUpdate.error || "Saved on server; database photo column not updated",
      })
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          dbUpdate.error ||
          "Could not save photo URL to account_seller.photo. Check ONBOARDING_MYSQL_* in .env.local.",
      },
      { status: 500 },
    )
  }

  const savedPhoto = (await getAccountSellerPhoto(account)) || photoDbValue
  const sellerLabel = dbUpdate.owner || account

  console.log(
    `[account/photo] Upload complete — image saved successfully for seller ${sellerLabel} (${account}) file=${stored.fileName} db=${savedPhoto}${backendOk ? " java=ok" : ""}`,
  )

    return NextResponse.json({
      ok: true,
      photo: savedPhoto,
      imageUrl: resolveSellerPhotoUrl(savedPhoto) || displayUrl,
      dbSaved: true,
      backendOk,
      backendPhoto: backendPhoto || undefined,
      sellerName: dbUpdate.owner,
    })
}
