"use client"

import type React from "react"
import { startTransition, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import type { User, UserRole } from "@/lib/auth-store"
import { getStrongPasswordError } from "@/lib/password-policy"

// --- LOGGING UTILITY (fully disabled to avoid leaking sensitive info) ---
const isLoginDebugEnabled = false
const log = (tag: string, msg: string, data?: any) => {
  if (!isLoginDebugEnabled) return
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8)
  if (data !== undefined) {
    console.log(`[${timestamp}] [${tag}] ${msg}`, data)
  } else {
    console.log(`[${timestamp}] [${tag}] ${msg}`)
  }
}

type ApiLoginOK = {
  ok: true
  role: "BUYER" | "SELLER" | "ADMIN" | "DRIVER" | "FINANCIER"
  ishyiga: string
  dbRole?: string
  dualPharmacyRetail?: boolean
  pharmacySector?: boolean
  /** Java: force_password_change after temporary password */
  mustChangePassword?: boolean
  /** Java: HMAC admin API token when ADMIN_API_SECRET is configured */
  adminApiToken?: string
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

/** Java/org.json may send boolean, 1/0, or snake_case; treat all as "must show change-password". */
function parseMustChangePassword(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false
  const v =
    json.mustChangePassword ?? json.must_change_password ?? (json as { force_password_change?: unknown }).force_password_change
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v == null) return false
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    return s === "1" || s === "true" || s === "yes"
  }
  return false
}

function toUserRoleFromAuth(auth: Pick<ApiLoginOK, "role" | "dualPharmacyRetail">): UserRole {
  const dbRole = auth.role?.toUpperCase()
  if (dbRole === "ADMIN") return "admin"
  if (auth.dualPharmacyRetail) return "supplier"
  if (dbRole === "SELLER") return "supplier"
  return "customer"
}

function normalizeToStoreUser(payload: ApiLoginOK): User {
  const u = (payload as any).user ?? {}
  const email = String(u.email ?? (payload as any).email ?? "").trim()
  if (!email) {
    throw new Error("Login succeeded but profile data is incomplete. Check Java user-auth JSON (user.email).")
  }
  const adminTok =
    typeof (payload as { adminApiToken?: unknown }).adminApiToken === "string"
      ? String((payload as { adminApiToken?: string }).adminApiToken).trim()
      : undefined

  return {
    id: email,
    email,
    name:
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      String(u.owner ?? "").trim() ||
      email,
    role: toUserRoleFromAuth(payload),
    dbRole: payload.dbRole,
    dualPharmacyRetail: !!payload.dualPharmacyRetail,
    pharmacySector: !!payload.pharmacySector,
    phone: String(u.tel ?? "").trim(),
    location: String(u.location ?? "").trim(),
    ishyigaAccount: payload.ishyiga || undefined,
    businessName: u.owner ? String(u.owner).trim() : undefined,
    ...(adminTok ? { adminApiToken: adminTok } : {}),
  }
}

function postLoginHomeForRole(role: UserRole | undefined): string {
  if (role === "admin") return "/admin/dashboard"
  if (role === "supplier") return "/supplier/dashboard"
  return "/"
}

/** Defer navigation so App Router is initialized and Zustand persist can settle (avoids "push before initialization"). */
function scheduleNavigation(router: ReturnType<typeof useRouter>, path: string) {
  queueMicrotask(() => {
    startTransition(() => {
      router.replace(path)
    })
  })
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [persistReady, setPersistReady] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingLoginPayload, setPendingLoginPayload] = useState<ApiLoginOK | null>(null)
  const [existingPassword, setExistingPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwChangeLoading, setPwChangeLoading] = useState(false)
  const [pwChangeError, setPwChangeError] = useState<string | null>(null)

  useEffect(() => {
    const done = () => setPersistReady(true)
    setPersistReady(!!useAuthStore.persist?.hasHydrated?.())
    const unsub = useAuthStore.persist?.onFinishHydration?.(done)
    return () => {
      unsub?.()
    }
  }, [])

  const handleSignOutStayOnLogin = () => {
    logout()
    scheduleNavigation(router, "/login")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const rid = crypto.randomUUID()
    log("LOGIN", `START [RID ${rid}]`)
    log("LOGIN", `Email: "${email}" (length=${email.length})`)
    log("LOGIN", `Password length: ${password.length}`)

    try {
      log("LOGIN", `Sending to /api/auth/login`)

      const emailTrimmed = email.trim()
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed, password }),
        credentials: "include",
      })

      log("LOGIN", `HTTP Status: ${res.status}`)

      const json = await res.json().catch(async () => {
        const text = await res.text()
        log("LOGIN", `ERROR parsing JSON:`, text.substring(0, 300))
        throw new Error("Bad JSON from auth server")
      })

      log("LOGIN", `Response:`, json)

      if (!res.ok || !json?.ok) {
        const j = json as Record<string, unknown>
        // Only `javaRid` is the backend request id; `rid` may be the Next.js proxy id.
        const javaRef =
          typeof j.javaRid === "string" && j.javaRid.trim() ? j.javaRid.trim() : ""
        const authCode = typeof j.code === "string" ? j.code.trim() : ""
        const serverErr = typeof j.error === "string" ? j.error.trim() : ""
        const looksInternal = /exception|sql|stack|internal server|0x/i.test(serverErr)
        const base =
          serverErr && !looksInternal && serverErr.length > 0 && serverErr.length < 240
            ? serverErr
            : "Invalid credentials"
        const ref = javaRef ? ` (Java ref: ${javaRef})` : ""
        const codeSuffix = authCode ? ` [${authCode}]` : ""
        throw new Error(`${base}${ref}${codeSuffix}`)
      }

      const payload = json as ApiLoginOK
      const mustChange = parseMustChangePassword(json as Record<string, unknown>)

      if (mustChange) {
        setPendingLoginPayload(payload)
        setExistingPassword(password)
        setNewPassword("")
        setConfirmPassword("")
        setPwChangeError(null)
        log("LOGIN", "mustChangePassword — show set-password dialog")
        return
      }

      const user: User = normalizeToStoreUser(payload)
      log("LOGIN", `User normalized:`, user)

      login(user)
      console.log(`[user-auth] logged in as ${user.email} role=${user.role}`)

      const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
      const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//")
      if (safeRedirect && decoded.length > 0) {
        scheduleNavigation(router, decoded)
        return
      }

      if (user.role === "admin") {
        scheduleNavigation(router, "/admin/dashboard")
      } else if (user.role === "supplier") {
        scheduleNavigation(router, "/supplier/dashboard")
      } else {
        scheduleNavigation(router, "/")
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network error"
      log("LOGIN", `ERROR: ${errorMsg}`)
      setError(errorMsg)
    } finally {
      setLoading(false)
      log("LOGIN", `END`)
    }
  }

  const finishLoginAndRedirect = (payload: ApiLoginOK) => {
    const user: User = normalizeToStoreUser(payload)
    login(user)
    console.log(`[user-auth] logged in as ${user.email} role=${user.role}`)
    setPendingLoginPayload(null)
    setExistingPassword("")
    setNewPassword("")
    setConfirmPassword("")
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//")
    if (safeRedirect && decoded.length > 0) {
      scheduleNavigation(router, decoded)
      return
    }
    if (user.role === "admin") {
      scheduleNavigation(router, "/admin/dashboard")
    } else if (user.role === "supplier") {
      scheduleNavigation(router, "/supplier/dashboard")
    } else {
      scheduleNavigation(router, "/")
    }
  }

  const handlePasswordChangeAfterLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwChangeError(null)
    const current = existingPassword.trim()
    if (!current) {
      setPwChangeError("Enter the password you used to sign in (temporary password)")
      return
    }
    const strongErr = getStrongPasswordError(newPassword)
    if (strongErr) {
      setPwChangeError(strongErr)
      return
    }
    if (newPassword.trim() === current) {
      setPwChangeError("New password must be different from your current password")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwChangeError("Passwords do not match")
      return
    }
    if (!pendingLoginPayload) return
    setPwChangeLoading(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) {
        setPwChangeError(j?.error || "Could not update password")
        return
      }
      finishLoginAndRedirect(pendingLoginPayload)
    } catch {
      setPwChangeError("Network error")
    } finally {
      setPwChangeLoading(false)
    }
  }

  const signedIn = persistReady && isAuthenticated && !!user
  const backHref = signedIn ? postLoginHomeForRole(user?.role) : "/"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Avoid sending logged-in admin to `/` — home page redirects admins back to the dashboard */}
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {signedIn ? "Back to app" : "Back to Home"}
          </Button>
        </Link>

        {signedIn && (
          <Card className="w-full border-blue-200 bg-blue-50/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Still signed in</CardTitle>
              <CardDescription>
                You are signed in as <span className="font-medium text-foreground">{user.email}</span>
                {user.role ? ` (${user.role})` : ""}. Opening <code className="text-xs">/login</code> does not sign you
                out — other tabs can still show the admin app until you use <span className="font-medium">Sign out</span>{" "}
                here (then refresh stays on this page).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="sm:flex-1"
                onClick={() => scheduleNavigation(router, postLoginHomeForRole(user.role))}
              >
                Continue to dashboard
              </Button>
              <Button type="button" variant="outline" className="sm:flex-1" onClick={handleSignOutStayOnLogin}>
                Sign out
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="w-full">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga Software"
                width={200}
                height={60}
                className="h-12 w-auto"
                priority
              />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center space-y-3">
              <p className="text-sm">
                <Link href="/forgot-password" className="text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline font-medium">Register here</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!pendingLoginPayload} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(ev) => ev.preventDefault()} onEscapeKeyDown={(ev) => ev.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Set a new password</DialogTitle>
              <DialogDescription>
                Confirm the temporary password you used to sign in, then choose a strong new password (10+ characters with
                uppercase, lowercase, number, and symbol).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordChangeAfterLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="existing-pw">Current password</Label>
                <Input
                  id="existing-pw"
                  type="password"
                  value={existingPassword}
                  onChange={(e) => setExistingPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 10 characters with uppercase, lowercase, a number, and a symbol. It must not match your
                  current password.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm new password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </div>
              {pwChangeError && <p className="text-sm text-destructive">{pwChangeError}</p>}
              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto" disabled={pwChangeLoading}>
                  {pwChangeLoading ? "Saving…" : "Save and continue"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}