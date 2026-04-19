/**
 * Shared client-side login used by `/login` and Grandma seller gate.
 * Proxies to `POST /api/auth/login` (Java auth).
 */
import type { User, UserRole } from "@/lib/auth-store"

export type ApiLoginOK = {
  ok: true
  role: "BUYER" | "SELLER" | "ADMIN" | "DRIVER" | "FINANCIER"
  ishyiga: string
  dbRole?: string
  dualPharmacyRetail?: boolean
  pharmacySector?: boolean
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

function toUserRoleFromAuth(auth: Pick<ApiLoginOK, "role" | "dualPharmacyRetail">): UserRole {
  const dbRole = auth.role?.toUpperCase()
  if (dbRole === "ADMIN") return "admin"
  if (auth.dualPharmacyRetail) return "supplier"
  if (dbRole === "SELLER") return "supplier"
  return "customer"
}

/** Java/org.json may send boolean, 1/0, or snake_case; treat all as "must show change-password". */
export function parseMustChangePassword(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false
  const v =
    json.mustChangePassword ??
    json.must_change_password ??
    (json as { force_password_change?: unknown }).force_password_change
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v == null) return false
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes"
  }
  return false
}

export type LoginWithCredentialsResult =
  | { outcome: "user"; user: User }
  | { outcome: "must_change"; payload: ApiLoginOK }

export function normalizeJavaLoginToUser(payload: ApiLoginOK): User {
  const u = (payload as unknown as { user?: Record<string, string> }).user ?? {}
  const email = String(u.email ?? "").trim()
  const phone = String(u.tel ?? "").trim()
  const ishyiga = String(payload.ishyiga ?? "").trim()
  if (!email && !phone && !ishyiga) {
    throw new Error("Login succeeded but profile data is incomplete.")
  }
  const id = phone || email || ishyiga
  const displayEmail = email || (phone ? `${phone}@phone.local` : "")
  return {
    id,
    email: displayEmail,
    name:
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      String(u.owner ?? "").trim() ||
      phone ||
      email ||
      ishyiga,
    role: toUserRoleFromAuth(payload),
    dbRole: payload.dbRole,
    dualPharmacyRetail: !!payload.dualPharmacyRetail,
    pharmacySector: !!payload.pharmacySector,
    phone,
    location: String(u.location ?? "").trim(),
    ishyigaAccount: payload.ishyiga || undefined,
    businessName: u.owner ? String(u.owner).trim() : undefined,
  }
}

export async function loginWithCredentialsResult(
  phoneOrEmail: string,
  password: string,
): Promise<LoginWithCredentialsResult> {
  const trimmed = phoneOrEmail.trim()
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: trimmed, password }),
    credentials: "include",
  })
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok || !json || !(json as { ok?: boolean }).ok) {
    const msg = String((json as { error?: string } | null)?.error || "Invalid credentials")
    throw new Error(msg)
  }
  if (parseMustChangePassword(json)) {
    return { outcome: "must_change", payload: json as unknown as ApiLoginOK }
  }
  return { outcome: "user", user: normalizeJavaLoginToUser(json as unknown as ApiLoginOK) }
}

export async function loginWithCredentials(phoneOrEmail: string, password: string): Promise<User> {
  const r = await loginWithCredentialsResult(phoneOrEmail, password)
  if (r.outcome === "must_change") {
    throw new Error("Password change required. Use the full sign-in page to set a new password.")
  }
  return r.user
}

/** Seller / supplier access for Grandma gate (SELLER role or dual pharmacy retail). */
export function userCanAccessSellerSpace(user: User | null): boolean {
  if (!user) return false
  if (user.role === "supplier") return true
  const db = user.dbRole?.toUpperCase()
  return db === "SELLER"
}
