"use client"

import { Suspense, useLayoutEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import type { User } from "@/lib/auth-store"
import { IshyigaLoginCard } from "@/components/ishyiga-login-card"
import { GRANDMA_PATHS, readGrandmaSignupRole, writeGrandmaSignupRole } from "@/lib/grandma-urls"
import { grandmaUserCanUseSellerWorkspace, isAdminUser } from "@/lib/auth-login-client"
import { useTranslation } from "@/hooks/use-translation"

const LOGIN_UI = {
  en: {
    headerTitle: "Sign in",
    backToHome: "Back to Home",
    welcome: "Welcome back",
    description: "Sign in with your phone number",
    submitLabel: "Sign in",
    registerSeller: "Register as seller",
    registerBuyer: "Register as buyer",
    loading: "Loading\u2026",
  },
  rw: {
    headerTitle: "Injira",
    backToHome: "Subira ahabanza",
    welcome: "Murakaza neza",
    description: "Injira ukoresheje nimero ya telefoni",
    submitLabel: "Injira",
    registerSeller: "Iyandikishe nk\u2019umucuruzi",
    registerBuyer: "Iyandikishe nk\u2019umuguzi",
    loading: "Turimo gutunganya\u2026",
  },
  fr: {
    headerTitle: "Connexion",
    backToHome: "Retour \u00e0 l\u2019accueil",
    welcome: "Bienvenue",
    description: "Connectez-vous avec votre num\u00e9ro de t\u00e9l\u00e9phone",
    submitLabel: "Se connecter",
    registerSeller: "S\u2019inscrire comme vendeur",
    registerBuyer: "S\u2019inscrire comme acheteur",
    loading: "Chargement\u2026",
  },
} as const

const shell =
  "min-h-screen bg-[#eef4fb] text-[#17324d] flex flex-col bg-gradient-to-b from-[#e8f5ff] to-[#dff0ff]"

function GrandmaLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginStore = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const redirectTo = searchParams?.get("redirect")
  const phonePrefill = searchParams?.get("phone") ?? ""
  const { language } = useTranslation()
  const ui = LOGIN_UI[language] ?? LOGIN_UI.en

  const [registerHref, setRegisterHref] = useState("/register/buyer")

  useLayoutEffect(() => {
    setRegisterHref(readGrandmaSignupRole() === "seller" ? "/register/seller" : "/register/buyer")
  }, [])

  useLayoutEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return
    if (isAdminUser(user)) {
      router.replace("/admin/dashboard")
    }
  }, [hasHydrated, isAuthenticated, user, router])

  const handleSuccess = async (user: User) => {
    loginStore(user)
    try {
      const asSeller = grandmaUserCanUseSellerWorkspace(user)
      const mode = asSeller ? "seller" : "buyer"
      localStorage.setItem("grandma:mode", mode)
      writeGrandmaSignupRole(asSeller ? "seller" : "buyer")
    } catch {
      /* ignore */
    }
    const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
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
            aria-label={ui.backToHome}
          >
            ←
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white">
              <Image src="/images/ishyiga-logo.png" alt="" width={34} height={34} className="object-contain" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold leading-tight">{ui.headerTitle}</div>
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
          {ui.backToHome}
        </Link>

        <IshyigaLoginCard
          title={ui.welcome}
          description={ui.description}
          submitLabel={ui.submitLabel}
          defaultPhone={phonePrefill}
          registerHref={registerHref}
          registerLinkText={
            registerHref === "/register/seller" ? ui.registerSeller : ui.registerBuyer
          }
          forgotHref="/forgot-password/grandma"
          loginMode="phoneOnly"
          uiVariant="grandma"
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  )
}

export default function GrandmaLoginPage() {
  const { language } = useTranslation()
  const ui = LOGIN_UI[language] ?? LOGIN_UI.en
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#eef4fb] text-[#6f8399] text-sm">
          {ui.loading}
        </div>
      }
    >
      <GrandmaLoginInner />
    </Suspense>
  )
}
