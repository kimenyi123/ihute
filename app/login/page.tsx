"use client"

import { Suspense } from "react"
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
      </div>
    </div>
  )
}

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
    </Suspense>
  )
}
