"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useAuthStore, type User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"

const shell = "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 p-4"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const login = useAuthStore((s) => s.login)

  const handleSuccess = async (user: User) => {
    login(user)

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

  return (
    <div className={shell}>
      <div className="w-full max-w-md space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-[#17324d]">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <IshyigaLoginCard onSuccess={handleSuccess} />
      </div>
    </div>
  )
}
