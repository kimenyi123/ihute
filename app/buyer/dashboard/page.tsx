"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingBag, FileSpreadsheet, ArrowRight } from "lucide-react"

export default function BuyerDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Buyer Dashboard</h1>
        <p className="text-slate-600 mb-8">
          Welcome, {user?.name || user?.email}. Manage your orders and upload Umusada data.
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
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Umusada Excel Upload
              </CardTitle>
              <CardDescription>
                Upload Sales, Purchase, Financial, or Supplier data to Umusada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/buyer/umusada/upload" className="gap-2">
                  Upload Excel
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
