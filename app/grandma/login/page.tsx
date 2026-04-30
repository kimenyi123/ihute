"use client"

import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import type { User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import { userCanAccessSellerSpace } from "@/lib/auth-login-client"

const shell =
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#e8f5ff] to-[#dff0ff]"

function GrandmaLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginStore = useAuthStore((s) => s.login)
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""

  const isAdminUser = (user: User): boolean =>
    user.role === "admin" || String(user.dbRole ?? "").toUpperCase() === "ADMIN"

  const handleSuccess = async (user: User) => {
    loginStore(user)
    try {
      localStorage.setItem("grandma:mode", userCanAccessSellerSpace(user) ? "seller" : "buyer")
    } catch {
      /* ignore */
    }
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    // Admin should always land on admin workspace, even if arriving from grandma redirects.
    if (isAdminUser(user)) {
      router.push("/admin/dashboard")
      return
    }
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      router.push(decoded)
      return
    }
    router.push(GRANDMA_PATHS.appRoot)
  }

  return (
    <div className={shell}>
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
        <div className="mx-auto flex max-w-[430px] items-center gap-2 px-3 py-3.5">
          <Link
            href={GRANDMA_PATHS.appRoot}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
            aria-label="Back to Grandma"
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
          href={GRANDMA_PATHS.appRoot}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#1897e0] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <IshyigaLoginCard
          title="Welcome back"
          description="Sign in with your phone number or email"
          submitLabel="Sign in"
          defaultPhone={phonePrefill}
          registerHref="/register/buyer"
          forgotHref="/forgot-password"
          loginMode="phoneOrEmail"
          uiVariant="grandma"
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  )
}

export default function GrandmaLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#eef4fb] text-[#6f8399] text-sm">
          Loading…
        </div>
      }
    >
      <GrandmaLoginInner />
    </Suspense>
  )
}
