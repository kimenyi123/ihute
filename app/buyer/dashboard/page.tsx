"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useAuthPersistHydrated } from "@/lib/use-auth-persist-hydrated"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingBag, ArrowRight, Smartphone, Loader2 } from "lucide-react"

type TopupPeriodParam = 30 | 90 | "all"

type TopupSummary = {
  topupSalesTotal: number
  topupLineCount: number
  topupOrdersCount: number
  period: "all" | "range"
  rangeDays: number | null
  ordersScanned: number
}

export default function BuyerDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const authHydrated = useAuthPersistHydrated()
  const [topup, setTopup] = useState<TopupSummary | null>(null)
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupErr, setTopupErr] = useState<string | null>(null)
  const [topupPeriod, setTopupPeriod] = useState<TopupPeriodParam>(30)

  useEffect(() => {
    if (!authHydrated) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [authHydrated, isAuthenticated, router])

  useEffect(() => {
    if (!authHydrated) return
    const acct = user?.ishyigaAccount?.trim()
    if (!acct) {
      setTopup(null)
      setTopupErr(null)
      return
    }

    let cancelled = false
    setTopupLoading(true)
    setTopupErr(null)

    const daysQ = topupPeriod === "all" ? "all" : String(topupPeriod)
    fetch(`/api/buyer/topup-sales?account=${encodeURIComponent(acct)}&days=${daysQ}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data?.ok) {
          setTopupErr(data?.error || "Could not load top-up summary")
          setTopup(null)
          return
        }
        const period = data.period === "all" ? "all" : "range"
        const rangeDays =
          period === "all"
            ? null
            : typeof data.rangeDays === "number" && !Number.isNaN(data.rangeDays)
              ? data.rangeDays
              : Number(data.days) || 30
        setTopup({
          topupSalesTotal: Number(data.topupSalesTotal) || 0,
          topupLineCount: Number(data.topupLineCount) || 0,
          topupOrdersCount: Number(data.topupOrdersCount) || 0,
          period,
          rangeDays,
          ordersScanned: Number(data.ordersScanned) || 0,
        })
      })
      .catch(() => {
        if (!cancelled) setTopupErr("Could not load top-up summary")
      })
      .finally(() => {
        if (!cancelled) setTopupLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authHydrated, user?.ishyigaAccount, topupPeriod])

  if (!authHydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Checking session…</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <main className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Buyer Dashboard</h1>
      <p className="text-slate-600 mb-8">
        Welcome, {user?.name || user?.email}. Manage your orders here.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
              Order Reports
            </CardTitle>
            <CardDescription>View your order history, status, and financing options.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/buyer/orders" className="gap-2">
                View Orders
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Top-up sales
            </CardTitle>
            <CardDescription>
              Spend on airtime, bundles, and similar lines from your orders
              {topup?.period === "all"
                ? " (all time, within scan limit)."
                : topup?.rangeDays != null
                  ? ` (last ${topup.rangeDays} days).`
                  : " (last 30 days)."}
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              {([30, 90, "all"] as const).map((p) => (
                <Button
                  key={String(p)}
                  type="button"
                  variant={topupPeriod === p ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setTopupPeriod(p)}
                >
                  {p === "all" ? "All" : `${p}d`}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!user?.ishyigaAccount?.trim() ? (
              <p className="text-sm text-slate-600">
                Your Ishyiga account is not linked to this session, so top-up totals cannot be loaded. Use{" "}
                <Link href="/buyer/orders" className="text-blue-600 underline">
                  Order Reports
                </Link>{" "}
                after your profile includes an Ishyiga buyer account.
              </p>
            ) : topupLoading ? (
              <p className="text-sm text-slate-500">Loading top-up summary…</p>
            ) : topupErr ? (
              <p className="text-sm text-red-600">{topupErr}</p>
            ) : topup ? (
              <>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {topup.topupSalesTotal.toLocaleString()} RWF
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {topup.topupOrdersCount} order{topup.topupOrdersCount === 1 ? "" : "s"} with top-up lines ·{" "}
                    {topup.topupLineCount} line{topup.topupLineCount === 1 ? "" : "s"}
                    {topup.ordersScanned > 0 ? ` · ${topup.ordersScanned} orders scanned` : ""}
                    {topup.period === "all" ? " (capped for speed)" : ""}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/buyer/orders" className="gap-2">
                    View orders
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
