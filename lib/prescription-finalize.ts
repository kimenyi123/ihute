/**
 * Move a pending prescription upload into prescriptions/{orderId}/{token}.ext
 * and return the public URL. Filenames already contain an unguessable token.
 */
import {
  existsSync,
  mkdirSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  readdirSync,
  rmSync,
} from "fs"
import path from "path"
import {
  getOrderPrescriptionDir,
  getPendingPrescriptionDir,
  publicUrlForPrescriptionFile,
  sanitizeSegment,
} from "@/lib/prescription-upload-paths"

export type FinalizePrescriptionResult = {
  ok: boolean
  publicUrl?: string
  error?: string
}

/**
 * @param pendingKey - folder under prescriptions/pending/
 * @param pendingRelativeOrUrl - optional specific file; if omitted, uses first file in pending folder
 * @param orderId - destination order id folder
 */
export function finalizePendingPrescription(
  pendingKey: string,
  orderId: string | number,
  pendingRelativeOrUrl?: string,
): FinalizePrescriptionResult {
  const key = sanitizeSegment(pendingKey)
  const oid = String(orderId || "").trim()
  if (!key || !oid) {
    return { ok: false, error: "pendingKey and orderId required" }
  }

  const pendingDir = getPendingPrescriptionDir(key)
  if (!existsSync(pendingDir)) {
    return { ok: false, error: "pending prescription folder not found" }
  }

  let fileName = ""
  if (pendingRelativeOrUrl) {
    const raw = pendingRelativeOrUrl.replace(/\\/g, "/")
    const match = raw.match(/\/uploads\/prescriptions\/pending\/[^/]+\/([^/?#]+)/i)
    if (match) fileName = match[1]
    else if (!raw.includes("/") && !raw.includes("\\")) fileName = raw
    else fileName = path.basename(raw.split("?")[0])
  }
  if (!fileName) {
    const files = readdirSync(pendingDir).filter((f) => !f.startsWith("."))
    if (files.length === 0) {
      return { ok: false, error: "no pending prescription file" }
    }
    fileName = files[0]
  }

  const src = path.join(pendingDir, fileName)
  if (!existsSync(src)) {
    return { ok: false, error: "pending prescription file missing" }
  }

  const destDir = getOrderPrescriptionDir(oid)
  mkdirSync(destDir, { recursive: true })
  const dest = path.join(destDir, fileName)

  try {
    renameSync(src, dest)
  } catch {
    try {
      copyFileSync(src, dest)
      unlinkSync(src)
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "failed to move prescription file",
      }
    }
  }

  // Remove empty pending folder if possible
  try {
    const left = readdirSync(pendingDir)
    if (left.length === 0) {
      rmSync(pendingDir, { recursive: true, force: true })
    }
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    publicUrl: publicUrlForPrescriptionFile(`${oid}/${fileName}`),
  }
}
