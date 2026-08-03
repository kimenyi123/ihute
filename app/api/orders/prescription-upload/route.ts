import { NextRequest, NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"
import { cleanupStalePendingPrescriptions } from "@/lib/prescription-pending-cleanup"
import { writePendingPrescriptionMeta } from "@/lib/prescription-pending-auth"
import {
  ensureDir,
  extensionForMime,
  getPendingPrescriptionDir,
  newPendingKey,
  newPrescriptionFileToken,
  PRESCRIPTION_MAX_BYTES,
  publicUrlForPrescriptionFile,
  sanitizeSegment,
} from "@/lib/prescription-upload-paths"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/orders/prescription-upload
 * Dedicated Rx photo uploader (does NOT import shop-image / account-photo / Urubuto uploaders).
 *
 * Multipart: file (required), pendingKey (optional), buyerEmail (optional ownership hint).
 * Stores under public/uploads/prescriptions/pending/{pendingKey}/{64hex}.{ext}
 * Writes .meta.json bound to ihute_sid cookie (+ optional buyerEmail) for createOrder ownership checks.
 */
export async function POST(req: NextRequest) {
  try {
    cleanupStalePendingPrescriptions()
  } catch {
    /* best-effort */
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid multipart body" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 })
  }
  if (file.size <= 0 || file.size > PRESCRIPTION_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File must be between 1 byte and ${PRESCRIPTION_MAX_BYTES} bytes` },
      { status: 400 },
    )
  }

  const ext = extensionForMime(file.type, file.name)
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "Only JPEG, PNG, or HEIC prescription photos are allowed" },
      { status: 400 },
    )
  }

  const sessionId = (req.cookies.get("ihute_sid")?.value || "").trim()
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "Missing session — refresh the page and try again" },
      { status: 400 },
    )
  }

  const buyerEmail = String(form.get("buyerEmail") || "").trim().toLowerCase() || undefined
  const incomingKey = sanitizeSegment(String(form.get("pendingKey") || ""))
  const pendingKey = incomingKey || newPendingKey()
  const token = newPrescriptionFileToken()
  const fileName = `${token}.${ext}`
  const dir = getPendingPrescriptionDir(pendingKey)
  ensureDir(dir)
  const absolutePath = path.join(dir, fileName)

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(absolutePath, buf)
    writePendingPrescriptionMeta(pendingKey, {
      sessionId,
      buyerEmail,
      createdAt: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save prescription"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const relative = `pending/${pendingKey}/${fileName}`
  const publicUrl = publicUrlForPrescriptionFile(relative)

  return NextResponse.json({
    ok: true,
    pendingKey,
    fileName,
    publicUrl,
    relativePath: relative,
  })
}
