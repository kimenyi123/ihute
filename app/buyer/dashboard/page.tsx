"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useAuthPersistHydrated } from "@/lib/use-auth-persist-hydrated"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingBag, ArrowRight, Loader2 } from "lucide-react"

export default function BuyerDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const authHydrated = useAuthPersistHydrated()

  useEffect(() => {
    if (!authHydrated) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [authHydrated, isAuthenticated, router])

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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 container mx-auto px-6 py-8">
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

          {/* Umusada Excel upload — commented out (same as buyer sidebar)
          <Card>...</Card>
          */}
        </div>
      </main>

      <Footer />
    </div>
  )
}
