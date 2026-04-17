"use client"

import { Suspense } from "react"
<<<<<<< HEAD
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { GrandmaLoginForm } from "@/components/grandma-login-form"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"

function GrandmaLoginInner() {
  const searchParams = useSearchParams()
  const redirectRaw = searchParams.get("redirect")
  const redirectTo =
    redirectRaw && redirectRaw.startsWith("/") && !redirectRaw.startsWith("//")
      ? redirectRaw
      : GRANDMA_PATHS.appRoot
  const phone = searchParams.get("phone") ?? ""

  return (
    <div className="grandma-login-page min-h-screen bg-[#f5f1ea] text-[#2c2620]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-10">
        <Link
          href={GRANDMA_PATHS.appRoot}
          className="grandma-login-back mb-6 text-sm font-semibold text-[#5c4f42] hover:text-[#3d342c]"
        >
          ← Back to Ihute
        </Link>
        <GrandmaLoginForm redirectTo={redirectTo} defaultPhoneOrEmail={phone} />
=======
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useAuthStore, type User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { userCanAccessSellerSpace } from "@/lib/auth-login-client"
import { APP_VERSION_DISPLAY } from "@/lib/app-version"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"

const shell =
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#f7fbff] to-[#eef4fb]"

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""
  const login = useAuthStore((s) => s.login)

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

  const handleSuccess = async (user: User) => {
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//") && decoded.length > 0

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

    if (user.role === "admin") {
      router.push("/admin/dashboard")
    } else if (user.role === "supplier") {
      router.push("/supplier/dashboard")
    } else {
      router.push("/")
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
>>>>>>> origin/GRANDMA
      </div>

      <footer className="mt-auto pb-6 pt-2 text-center text-xs font-medium tabular-nums text-[#6f8399]">
        {APP_VERSION_DISPLAY}
      </footer>
    </div>
  )
}

<<<<<<< HEAD
/** Seller login for the Ihute market flow (`/grandma` routes). Warm styling, not the default `/login` page. */
export default function GrandmaLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grandma-login-page flex min-h-screen items-center justify-center bg-[#f5f1ea] text-[#6b5e52]">
          Loading…
        </div>
      }
    >
      <GrandmaLoginInner />
=======
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
>>>>>>> origin/GRANDMA
    </Suspense>
  )
}
