"use client"

import { Suspense, useState, type FormEvent } from "react"
import Image from "next/image"
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
import { normalizeJavaLoginToUser, userCanAccessSellerSpace } from "@/lib/auth-login-client"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { APP_VERSION_DISPLAY } from "@/lib/app-version"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
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
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#f7fbff] to-[#eef4fb]"

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""
  const loginStore = useAuthStore((s) => s.login)

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

  const applyGrandmaModeHint = (user: User, decodedRedirect: string) => {
    if (typeof window === "undefined") return
    if (!decodedRedirect.startsWith("/grandma")) return
    try {
      localStorage.setItem("grandma:mode", userCanAccessSellerSpace(user) ? "seller" : "buyer")
    } catch {
      /* ignore */
    }
  }

  const finishLoginAndRedirect = (payload: ApiLoginOK) => {
    const user: User = normalizeJavaLoginToUser(payload)
    loginStore(user)
    setPendingLoginPayload(null)
    setExistingPassword("")
    setNewPassword("")
    setConfirmPassword("")
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0
    applyGrandmaModeHint(user, decoded)
    if (safeRedirect) {
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

  const handleSuccess = async (user: User) => {
    log("LOGIN", "success", user)
    loginStore(user)
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0
    applyGrandmaModeHint(user, decoded)
    if (safeRedirect) {
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

  const handleMustChangePassword = (payload: ApiLoginOK, password: string) => {
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
          onMustChangePassword={handleMustChangePassword}
          defaultPhone={phonePrefill}
          registerHref="/register/buyer"
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
