"use client"

import { Suspense, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/lib/auth-store"
import type { User } from "@/lib/auth-store"
import type { ApiLoginOK } from "@/lib/auth-login-client"
import {
  grandmaUserCanUseSellerWorkspace,
  isAdminUser,
  normalizeJavaLoginToUser,
} from "@/lib/auth-login-client"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { APP_VERSION_DISPLAY } from "@/lib/app-version"
import { GRANDMA_PATHS, writeGrandmaSignupRole } from "@/lib/grandma-urls"
import { getStrongPasswordError } from "@/lib/password-policy"

const isLoginDebugEnabled = false
const log = (tag: string, msg: string, data?: unknown) => {
  if (!isLoginDebugEnabled) return
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8)
  if (data !== undefined) {
    console.log(`[${timestamp}] [${tag}] ${msg}`, data)
  } else {
    console.log(`[${timestamp}] [${tag}] ${msg}`)
  }
}

const shell =
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#e8f5ff] to-[#dff0ff]"

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""
  const loginStore = useAuthStore((s) => s.login)
  const clearSessionExpiredReason = useAuthStore((s) => s.clearSessionExpiredReason)

  const [rememberMe, setRememberMe] = useState(false)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [pendingLoginPayload, setPendingLoginPayload] = useState<ApiLoginOK | null>(null)
  const [existingPassword, setExistingPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwChangeLoading, setPwChangeLoading] = useState(false)
  const [pwChangeError, setPwChangeError] = useState<string | null>(null)

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

  const adminLoginIntent = (() => {
    if (!redirectTo) return false
    try {
      return decodeURIComponent(redirectTo).startsWith("/admin")
    } catch {
      return redirectTo.startsWith("/admin")
    }
  })()

  useEffect(() => {
    if (!redirectTo) return
    let decoded = ""
    try {
      decoded = decodeURIComponent(redirectTo)
    } catch {
      decoded = redirectTo
    }
    if (!decoded.startsWith("/grandma")) return
    const qs = new URLSearchParams()
    qs.set("redirect", redirectTo)
    if (phonePrefill) qs.set("phone", phonePrefill)
    router.replace(`/grandma/login?${qs.toString()}`)
  }, [redirectTo, phonePrefill, router])

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("ihute_session_expired")
      if (flag === "idle") {
        setSessionNotice("You were signed out after a period of inactivity.")
      } else if (flag === "absolute") {
        setSessionNotice("Your session expired. Please sign in again.")
      }
      if (flag) sessionStorage.removeItem("ihute_session_expired")
    } catch {
      /* ignore */
    }
    clearSessionExpiredReason()
  }, [clearSessionExpiredReason])

  const applyGrandmaModeHint = (user: User, decodedRedirect: string) => {
    if (typeof window === "undefined") return
    if (!decodedRedirect.startsWith("/grandma")) return
    try {
      const asSeller = grandmaUserCanUseSellerWorkspace(user)
      const mode = asSeller ? "seller" : "buyer"
      localStorage.setItem("grandma:mode", mode)
      writeGrandmaSignupRole(asSeller ? "seller" : "buyer")
    } catch {
      /* ignore */
    }
  }

  const redirectAfterLogin = (user: User, decoded: string, safeRedirect: boolean) => {
    if (isAdminUser(user)) {
      router.push("/admin/dashboard")
      return
    }
    if (safeRedirect) {
      router.push(decoded)
      return
    }
    if (user.role === "supplier") {
      router.push("/supplier/dashboard")
    } else {
      router.push("/")
    }
  }

  const finishLoginAndRedirect = (payload: ApiLoginOK) => {
    const user: User = normalizeJavaLoginToUser(payload)
    loginStore(user, { rememberMe })
    setPendingLoginPayload(null)
    setExistingPassword("")
    setNewPassword("")
    setConfirmPassword("")
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0
    applyGrandmaModeHint(user, decoded)
    redirectAfterLogin(user, decoded, safeRedirect)
  }

  const handleSuccess = async (user: User, options?: { rememberMe?: boolean }) => {
    log("LOGIN", "success", user)
    const remember = Boolean(options?.rememberMe)
    setRememberMe(remember)
    loginStore(user, { rememberMe: remember })
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0
    applyGrandmaModeHint(user, decoded)
    redirectAfterLogin(user, decoded, safeRedirect)
  }

  const handleMustChangePassword = (
    payload: ApiLoginOK,
    password: string,
    options?: { rememberMe?: boolean },
  ) => {
    setRememberMe(Boolean(options?.rememberMe))
    setPendingLoginPayload(payload)
    setExistingPassword(password)
    setNewPassword("")
    setConfirmPassword("")
    setPwChangeError(null)
    log("LOGIN", "mustChangePassword — show set-password dialog")
  }

  const handlePasswordChangeAfterLogin = async (e: FormEvent) => {
    e.preventDefault()
    setPwChangeError(null)
    const current = existingPassword
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
        body: JSON.stringify({
          email: pendingLoginPayload?.user?.email,
          currentPassword: current,
          newPassword,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
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
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-3 py-6">
        <Link
          href={backHomeHref}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#1897e0] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {backHomeLabel}
        </Link>

        {sessionNotice ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {sessionNotice}
          </div>
        ) : null}

        <IshyigaLoginCard
          title="Welcome back"
          description={
            adminLoginIntent
              ? "Admin sign-in: use the email stored in account_signup (TYPE = ADMIN)."
              : "Sign in with your email address"
          }
          onSuccess={handleSuccess}
          onMustChangePassword={handleMustChangePassword}
          defaultPhone={phonePrefill}
          loginMode="emailOnly"
          uiVariant="ihute"
          forgotHref="/forgot-password/web-form"
          registerHref="/register/web-form"
          showRememberMe={!adminLoginIntent}
        />

        <Dialog open={!!pendingLoginPayload} onOpenChange={() => {}}>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(ev) => ev.preventDefault()}
            onEscapeKeyDown={(ev) => ev.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Set a new password</DialogTitle>
              <DialogDescription>
                Choose a strong new password (10+ characters with uppercase, lowercase, number, and symbol).
                We will use the same password you just used to sign in as your current password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordChangeAfterLogin} className="space-y-4">
              <input type="hidden" value={existingPassword} readOnly />
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
