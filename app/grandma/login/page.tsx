"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Old URL: `/grandma/login` → one shared sign-in at `/login`.
 * Preserves `?redirect=` and `?phone=` for bookmarks and onboarding links.
 */
function RedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const r = searchParams.get("redirect")
    const p = searchParams.get("phone")
    const qs = new URLSearchParams()
    if (r) qs.set("redirect", r)
    if (p) qs.set("phone", p)
    const q = qs.toString()
    router.replace(`/login${q ? `?${q}` : ""}`)
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea] text-[#6b5e52] text-sm">
      Redirecting to sign in…
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
      <RedirectInner />
    </Suspense>
  )
}
