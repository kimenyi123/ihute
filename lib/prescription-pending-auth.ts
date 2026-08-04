/**
 * Pending prescription ownership + URL validation.
 * Ensures createOrder only accepts files written by prescription-upload for this session/buyer.
 */
import { existsSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import {
  getPendingPrescriptionDir,
  sanitizeSegment,
} from "@/lib/prescription-upload-paths"

export type PendingPrescriptionMeta = {
  sessionId: string
  buyerEmail?: string
  createdAt: string
}

const META_FILE = ".meta.json"
const TOKEN_FILE_RE = /^[a-f0-9]{64}\.(jpg|jpeg|png|heic)$/i

/** Absolute path must stay under pending/{key}/ (no path traversal). */
function safePendingFile(pendingKey: string, fileName: string): string | null {
  const key = sanitizeSegment(pendingKey)
  const base = path.basename(fileName)
  if (!key || !TOKEN_FILE_RE.test(base)) return null
  const dir = getPendingPrescriptionDir(key)
  const full = path.join(dir, base)
  const resolved = path.resolve(full)
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    return null
  }
  return resolved
}

export function writePendingPrescriptionMeta(
  pendingKey: string,
  meta: PendingPrescriptionMeta,
): void {
  const key = sanitizeSegment(pendingKey)
  if (!key) return
  const dir = getPendingPrescriptionDir(key)
  const dest = path.join(dir, META_FILE)
  writeFileSync(dest, JSON.stringify(meta), "utf8")
}

export function readPendingPrescriptionMeta(
  pendingKey: string,
): PendingPrescriptionMeta | null {
  const key = sanitizeSegment(pendingKey)
  if (!key) return null
  const dest = path.join(getPendingPrescriptionDir(key), META_FILE)
  if (!existsSync(dest)) return null
  try {
    const raw = JSON.parse(readFileSync(dest, "utf8")) as PendingPrescriptionMeta
    if (!raw || typeof raw.sessionId !== "string" || !raw.sessionId.trim()) return null
    return {
      sessionId: raw.sessionId.trim(),
      buyerEmail: raw.buyerEmail?.trim() || undefined,
      createdAt: String(raw.createdAt || ""),
    }
  } catch {
    return null
  }
}

/**
 * Parse a client-supplied URL into pendingKey + fileName.
 * Only accepts relative (or same-path) URLs under /uploads/prescriptions/pending/.
 */
export function parsePendingPrescriptionUrl(raw: string): {
  pendingKey: string
  fileName: string
} | null {
  const s = String(raw || "").trim()
  if (!s) return null
  // Create/upload always use site-relative paths. Reject absolute URLs so a client
  // cannot smuggle https://evil/... that merely looks like our path shape.
  if (/^https?:\/\//i.test(s)) return null
  const m = s
    .replace(/\\/g, "/")
    .match(/^\/?uploads\/prescriptions\/pending\/([a-zA-Z0-9_-]+)\/([a-f0-9]{64}\.(?:jpg|jpeg|png|heic))(?:\?.*)?$/i)
  if (!m) return null
  return { pendingKey: m[1], fileName: m[2] }
}

export type ValidatePendingResult =
  | { ok: true; pendingKey: string; fileName: string; publicUrl: string }
  | { ok: false; error: string; code: string }

/**
 * Confirm the URL points at a real pending upload owned by this session (or buyer email).
 */
export function validatePendingPrescriptionClaim(args: {
  pendingKey?: string
  prescriptionImageUrl?: string
  sessionId?: string | null
  buyerEmail?: string | null
}): ValidatePendingResult {
  const url = String(args.prescriptionImageUrl || "").trim()
  const keyFromClient = sanitizeSegment(String(args.pendingKey || ""))
  if (!url && !keyFromClient) {
    return { ok: false, error: "Prescription upload missing", code: "PRESCRIPTION_MISSING" }
  }

  const parsed = url ? parsePendingPrescriptionUrl(url) : null
  if (url && !parsed) {
    return {
      ok: false,
      error: "Invalid prescription URL — must be a pending upload from this checkout",
      code: "PRESCRIPTION_URL_INVALID",
    }
  }

  const pendingKey = parsed?.pendingKey || keyFromClient
  const fileName = parsed?.fileName || ""
  if (!pendingKey) {
    return { ok: false, error: "pendingKey required", code: "PRESCRIPTION_PENDING_KEY" }
  }
  if (keyFromClient && parsed && keyFromClient !== parsed.pendingKey) {
    return {
      ok: false,
      error: "pendingKey does not match prescription URL",
      code: "PRESCRIPTION_KEY_MISMATCH",
    }
  }

  const meta = readPendingPrescriptionMeta(pendingKey)
  if (!meta) {
    return {
      ok: false,
      error: "Prescription upload not found or expired",
      code: "PRESCRIPTION_META_MISSING",
    }
  }

  const sessionId = String(args.sessionId || "").trim()
  const buyerEmail = String(args.buyerEmail || "").trim().toLowerCase()
  const metaEmail = (meta.buyerEmail || "").trim().toLowerCase()
  const sessionOk = Boolean(sessionId && meta.sessionId === sessionId)
  const emailOk = Boolean(buyerEmail && metaEmail && buyerEmail === metaEmail)
  if (!sessionOk && !emailOk) {
    return {
      ok: false,
      error: "Prescription upload does not belong to this checkout session",
      code: "PRESCRIPTION_OWNERSHIP",
    }
  }

  // Resolve file: prefer URL basename; else single image in folder
  let resolvedName = fileName
  if (!resolvedName) {
    return {
      ok: false,
      error: "Prescription file name required in URL",
      code: "PRESCRIPTION_FILE_REQUIRED",
    }
  }
  const abs = safePendingFile(pendingKey, resolvedName)
  if (!abs || !existsSync(abs)) {
    return {
      ok: false,
      error: "Prescription file not found on server",
      code: "PRESCRIPTION_FILE_MISSING",
    }
  }

  const publicUrl = `/uploads/prescriptions/pending/${pendingKey}/${resolvedName}`
  return { ok: true, pendingKey, fileName: resolvedName, publicUrl }
}
