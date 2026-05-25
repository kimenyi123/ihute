"use client"

import { Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BuyerOrdersPanel } from "@/components/buyer-orders-panel"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import { useTranslation } from "@/hooks/use-translation"

const ORDERS_HEADER = {
  en: { title: "Orders", subtitle: "Past orders & items", loading: "Loading orders\u2026" },
  rw: { title: "Amatumiza", subtitle: "Amatumiza yawe n\u2019ibicuruzwa", loading: "Turimo gutunganya\u2026" },
  fr: { title: "Commandes", subtitle: "Historique de commandes", loading: "Chargement\u2026" },
} as const

function GrandmaBuyerOrdersInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightOrderId = searchParams.get("orderId")
  const { language } = useTranslation()
  const ui = ORDERS_HEADER[language] ?? ORDERS_HEADER.en

  const loginRedirect = useMemo(
    () => `/login?redirect=${encodeURIComponent(GRANDMA_PATHS.buyerOrders)}`,
    [],
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#eef4fb] text-[#17324d]">
      <header className="sticky top-0 z-30 shrink-0 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-2 px-3 py-3.5">
          <button
            type="button"
            onClick={() => router.push(GRANDMA_PATHS.appRoot)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
            aria-label="Back to Grandma"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => router.push(GRANDMA_PATHS.appRoot)}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white"
            aria-label="Grandma home"
            title="Grandma home"
          >
            <img src="/img/logo.png" alt="" width={28} height={28} className="object-contain" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold leading-tight">{ui.title}</div>
            <div className="truncate text-xs text-white/90">{ui.subtitle}</div>
          </div>
        </div>
      </header>
      <BuyerOrdersPanel
        variant="grandma"
        loginRedirect={loginRedirect}
        highlightOrderId={highlightOrderId}
      />
    </div>
  )
}

export default function GrandmaBuyerOrdersPage() {
  const { language } = useTranslation()
  const ui = ORDERS_HEADER[language] ?? ORDERS_HEADER.en
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#eef4fb] text-sm text-[#17324d]">
          {ui.loading}
        </div>
      }
    >
      <GrandmaBuyerOrdersInner />
    </Suspense>
  )
}
