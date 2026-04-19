"use client"

import { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
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
import { useAuthStore, type User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { userCanAccessSellerSpace } from "@/lib/auth-login-client"
import { APP_VERSION_DISPLAY } from "@/lib/app-version"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
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

const shell =
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#f7fbff] to-[#eef4fb]"
type ApiLoginOK = {
  ok: true
  role: "BUYER" | "SELLER" | "ADMIN" | "DRIVER" | "FINANCIER"
  ishyiga: string
  dbRole?: string
  dualPharmacyRetail?: boolean
  pharmacySector?: boolean
  /** Java: force_password_change after temporary password */
  mustChangePassword?: boolean
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

function LoginPageInner() {
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
  }
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""
  const login = useAuthStore((s) => s.login)
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

  const backHomeHref = (() => {
    if (!redirectTo) return "/"
    try {
      const decoded = decodeURIComponent(redirectTo)
      if (decoded.startsWith("/grandma")) return GRANDMA_PATHS.appRoot
    } catch {
      /* ignore */
    }
    return "/"
  })()
  const backHomeLabel = backHomeHref === GRANDMA_PATHS.appRoot ? "Back to Grandma" : "Back to Home"
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
        throw new Error("Invalid credentials")
      }

  const handleSuccess = async (user: User) => {
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0
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

    // Grandma remembers buyer vs seller so /grandma opens the right space after sign-in.
    if (safeRedirect && decoded.startsWith("/grandma") && typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "grandma:mode",
          userCanAccessSellerSpace(user) ? "seller" : "buyer",
        )
      } catch {
        /* ignore */
      }
    }

    if (safeRedirect) {
      router.push(decoded)
      return
    }
      const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
      const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//")
      if (safeRedirect && decoded.length > 0) {
        router.push(decoded)
        return
      }

      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else if (user.role === "supplier") {
        router.push("/supplier/dashboard")
      } else {
        router.push("/")
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network error"
      log("LOGIN", `ERROR: ${errorMsg}`)
      setError(errorMsg)
    } finally {
      setLoading(false)
      log("LOGIN", `END`)
    if (user.role === "admin") {
      router.push("/admin/dashboard")
    } else if (user.role === "supplier") {
      router.push("/supplier/dashboard")
    } else {
      router.push("/")
    }
  }

  const finishLoginAndRedirect = (payload: ApiLoginOK) => {
    const user: User = normalizeToStoreUser(payload)
    login(user)
    setPendingLoginPayload(null)
    setExistingPassword("")
    setNewPassword("")
    setConfirmPassword("")
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//")
    if (safeRedirect && decoded.length > 0) {
      router.push(decoded)
      return
    }
    if (user.role === "admin") {
      router.push("/admin/dashboard")
    } else if (user.role === "supplier") {
      router.push("/supplier/dashboard")
    } else {
      router.push("/")
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

  return (
    <div className={shell}>
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
        <div className="mx-auto flex max-w-[430px] items-center gap-2 px-3 py-3.5">
          <Link
            href={backHomeHref}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
            aria-label={backHomeLabel}
          >
            ←
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white">
              <Image src="/images/ishyiga-logo.png" alt="" width={34} height={34} className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold leading-tight">Sign in</div>
              <div className="truncate text-xs text-white/90">Ishyiga Ihute</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 py-6">
        <Link
          href={backHomeHref}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#1897e0] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {backHomeLabel}
        </Link>

        <IshyigaLoginCard
          onSuccess={handleSuccess}
          defaultPhone={phonePrefill}
          registerHref="/register/buyer"
        />
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

      <footer className="mt-auto pb-6 pt-2 text-center text-xs font-medium tabular-nums text-[#6f8399]">
        {APP_VERSION_DISPLAY}
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={shell}>
          <div className="flex flex-1 items-center justify-center px-4 text-sm text-[#6f8399]">Loading…</div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
