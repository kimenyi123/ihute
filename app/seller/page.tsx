"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ShoppingBag } from "lucide-react"

export default function SellerDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7" />
          Seller dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome
          {user?.ishyigaAccount ? (
            <>
              , <span className="text-foreground font-medium">{user.name || user.ishyigaAccount}</span>
            </>
          ) : null}
          . Use the links below to manage your shop.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              See orders placed with your seller account. The list may be empty until customers order from your shop.
            </p>
            <Button asChild>
              <Link href="/seller/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
