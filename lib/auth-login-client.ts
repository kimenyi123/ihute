/**
 * Shared client-side login used by `/login` and Grandma seller gate.
 * Proxies to `POST /api/auth/login` (Java auth).
 */
import type { User, UserRole } from "@/lib/auth-store"
import { buildLoginCandidates, normalizeLoginIdentifierForJava, normalizePhoneDigitsForAuth, type LoginChannel } from "@/lib/rwanda-phone"

export type ApiLoginOK = {
  ok: true
  role: "BUYER" | "SELLER" | "ADMIN" | "DRIVER" | "FINANCIER"
  ishyiga: string
  dbRole?: string
  dualPharmacyRetail?: boolean
  pharmacySector?: boolean
  adminApiToken?: string
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

function toUserRoleFromAuth(auth: Pick<ApiLoginOK, "role" | "dbRole" | "dualPharmacyRetail">): UserRole {
  const roleField = String(auth.role ?? "").toUpperCase()
  const typeField = String(auth.dbRole ?? "").toUpperCase()
  if (roleField === "ADMIN" || typeField === "ADMIN") return "admin"
  if (auth.dualPharmacyRetail) return "supplier"
  if (roleField === "SELLER" || typeField === "SELLER") return "supplier"
  return "customer"
}

function truthyMustChangeFlag(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v == null) return false
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes"
  }
  return false
}

/** Java/org.json may send boolean, 1/0, or snake_case; treat all as "must show change-password". */
export function parseMustChangePassword(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false
  const candidates: unknown[] = [
    json.mustChangePassword,
    json.must_change_password,
    (json as { force_password_change?: unknown }).force_password_change,
  ]
  const user = json.user
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>
    candidates.push(u.force_password_change, u.forcePasswordChange, u.mustChangePassword)
  }
  for (const v of candidates) {
    if (truthyMustChangeFlag(v)) return true
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
  const adminTok =
    typeof (payload as { adminApiToken?: unknown }).adminApiToken === "string"
      ? String((payload as { adminApiToken: string }).adminApiToken).trim()
      : undefined
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
    dbRole:
      payload.dbRole ??
      (payload.role ? String(payload.role).toUpperCase() : undefined),
    dualPharmacyRetail: !!payload.dualPharmacyRetail,
    pharmacySector: !!payload.pharmacySector,
    phone,
    location: String(u.location ?? "").trim(),
    ishyigaAccount: payload.ishyiga || undefined,
    businessName: u.owner ? String(u.owner).trim() : undefined,
    ...(adminTok ? { adminApiToken: adminTok } : {}),
  }
}

/** Map Java `user-auth` errors to clearer copy (login still fails — DB/Java must match). */
export function humanizeAuthLoginError(json: Record<string, unknown> | null | undefined): string {
  const err = String(json?.error ?? "").trim()
  const code = String(json?.code ?? "").trim().toUpperCase()
  if (!err && !code) return "Invalid credentials"
  if (code === "AUTH_LOGIN_FAIL" && /account not found/i.test(err)) {
    return (
      "Account not found for this phone or email. Admin accounts often use a real email in the database — " +
      "try signing in with that email (not only 07…). If you use phone, TEL in account_signup must match."
    )
  }
  if (code === "AUTH_LOGIN_FAIL" && /password|credential|invalid/i.test(err)) {
    return err || "Wrong password for this account."
  }
  if (code === "AUTH_SERVER_ERROR") {
    return err || "Login temporarily unavailable. Please try again."
  }
  if (err) return err
  if (code) return `Login failed (${code})`
  return "Invalid credentials"
}

export async function loginWithCredentialsResult(
  phoneOrEmail: string,
  password: string,
  channel: LoginChannel = "auto",
): Promise<LoginWithCredentialsResult> {
  const trimmed = phoneOrEmail.trim()
  const emailForJava =
    channel === "email"
      ? trimmed
      : channel === "phone"
        ? normalizePhoneDigitsForAuth(trimmed) || trimmed
        : normalizeLoginIdentifierForJava(trimmed)

  const resolveChannel = (): LoginChannel => {
    if (channel === "email" || channel === "phone") return channel
    return trimmed.includes("@") ? "email" : "phone"
  }

  const doLogin = (loginId: string, loginChannel: LoginChannel) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginId, password, channel: loginChannel }),
      credentials: "include",
    })

  const activeChannel = resolveChannel()
  let res = await doLogin(emailForJava, activeChannel)
  let json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const loginFailed = () => !res.ok || !json || !(json as { ok?: boolean }).ok
  if (loginFailed() && activeChannel === "phone" && emailForJava !== trimmed && !trimmed.includes("@")) {
    res = await doLogin(trimmed, "phone")
    json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  }
  if (!res.ok || !json || !(json as { ok?: boolean }).ok) {
    throw new Error(humanizeAuthLoginError(json))
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

/** Platform admin (Java TYPE/role ADMIN). */
export function isAdminUser(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return String(user.dbRole ?? "").toUpperCase() === "ADMIN"
}

/** Alias used by login / admin-guard (same rule as isAdminUser). */
export const userIsPlatformAdmin = isAdminUser

/** Seller / supplier access for Grandma gate (SELLER role or dual pharmacy retail). */
export function userCanAccessSellerSpace(user: User | null): boolean {
  if (!user) return false
  if (user.role === "supplier") return true
  /** Backend may flag twin account_seller without mapping role to supplier yet. */
  if (user.dualPharmacyRetail) return true
  const db = user.dbRole?.toUpperCase()
  return db === "SELLER"
}

/**
 * Grandma MODE + seller UI: same as {@link userCanAccessSellerSpace}, plus `supplier_*` ishyiga accounts
 * when persisted auth omits role flags (e.g. older sessions).
 */
export function grandmaUserCanUseSellerWorkspace(user: User | null): boolean {
  if (!user) return false
  if (userCanAccessSellerSpace(user)) return true
  const acc = user.ishyigaAccount?.trim() ?? ""
  return /^supplier_/i.test(acc)
}
