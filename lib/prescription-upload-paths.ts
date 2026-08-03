/**
 * Prescription upload paths — dedicated module (no imports from shop-image / account-photo).
 */
import { existsSync, mkdirSync } from "fs"
import path from "path"
import { randomBytes } from "crypto"

const MAX_AGE_MS = 48 * 60 * 60 * 1000 // 48h pending cleanup

export function resolvePrescriptionPublicDir(): string {
  const explicit = (process.env.IHUTE_PUBLIC_DIR || "").trim()
  if (explicit) return path.resolve(explicit)
  const cwd = process.cwd()
  const fromCwd = path.join(cwd, "public")
  if (existsSync(fromCwd)) return fromCwd
  return fromCwd
}

export function getPrescriptionUploadsRoot(): string {
  const explicit = (process.env.PRESCRIPTION_UPLOADS_DIR || "").trim()
  if (explicit) return path.resolve(explicit)
  return path.join(resolvePrescriptionPublicDir(), "uploads", "prescriptions")
}

export function getPendingPrescriptionDir(pendingKey: string): string {
  return path.join(getPrescriptionUploadsRoot(), "pending", sanitizeSegment(pendingKey))
}

export function getOrderPrescriptionDir(orderId: string | number): string {
  return path.join(getPrescriptionUploadsRoot(), String(orderId))
}

/** Unguessable filename token (32 hex bytes). Order id alone is not enough to scrape. */
export function newPrescriptionFileToken(): string {
  return randomBytes(32).toString("hex")
}

export function newPendingKey(): string {
  return randomBytes(16).toString("hex")
}

export function sanitizeSegment(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 128)
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function publicUrlForPrescriptionFile(relativeUnderUploads: string): string {
  const rel = relativeUnderUploads.replace(/\\/g, "/").replace(/^\/+/, "")
  return `/uploads/prescriptions/${rel}`
}

export function extensionForMime(mime: string, originalName: string): string | null {
  const m = (mime || "").toLowerCase()
  const name = (originalName || "").toLowerCase()
  if (m === "image/jpeg" || m === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "jpg"
  }
  if (m === "image/png" || name.endsWith(".png")) return "png"
  if (m === "image/heic" || m === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")) {
    return "heic"
  }
  return null
}

export const PRESCRIPTION_MAX_BYTES = 8 * 1024 * 1024 // 8 MB
export const PRESCRIPTION_PENDING_MAX_AGE_MS = MAX_AGE_MS
