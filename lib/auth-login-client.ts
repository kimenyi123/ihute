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

export async function loginWithCredentials(phoneOrEmail: string, password: string): Promise<User> {
  const trimmed = phoneOrEmail.trim()
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: trimmed, password }),
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (!res.ok || !json || !(json as { ok?: boolean }).ok) {
    const msg = (json as { error?: string })?.error || "Invalid credentials"
    throw new Error(msg)
  }
  return normalizeJavaLoginToUser(json as ApiLoginOK)
}

/** Seller / supplier access for Grandma gate (SELLER role or dual pharmacy retail). */
export function userCanAccessSellerSpace(user: User | null): boolean {
  if (!user) return false
  if (user.role === "supplier") return true
  const db = user.dbRole?.toUpperCase()
  return db === "SELLER"
}
