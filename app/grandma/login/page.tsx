"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import type { User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import { userCanAccessSellerSpace } from "@/lib/auth-login-client"

function GrandmaLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginStore = useAuthStore((s) => s.login)
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""

  const handleSuccess = async (user: User) => {
    loginStore(user)
    try {
      localStorage.setItem("grandma:mode", userCanAccessSellerSpace(user) ? "seller" : "buyer")
    } catch {
      /* ignore */
    }
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      router.push(decoded)
      return
    }
    router.push(GRANDMA_PATHS.appRoot)
  }

  return (
    <div className="min-h-screen bg-[#f5f1ea] text-[#3e342c]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 py-6">
        <Link
          href={GRANDMA_PATHS.appRoot}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#8b5e3c] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Grandma
        </Link>

        <IshyigaLoginCard
          title="Grandma sign in"
          description="Sign in with your phone number"
          submitLabel="Sign in to Grandma"
          defaultPhone={phonePrefill}
          registerHref="/register/buyer"
          forgotHref="/forgot-password"
          loginMode="phoneOnly"
          onSuccess={handleSuccess}
          className="border-[#e7d8c9] bg-[#fffdf9] shadow-[0_8px_18px_rgba(80,52,35,.08)]"
        />
      </div>
    </div>
  )
}

export default function GrandmaLoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea] text-[#6b5e52] text-sm">
          Loading…
        </div>
      }
    >
      <GrandmaLoginInner />
    </Suspense>
  )
}
