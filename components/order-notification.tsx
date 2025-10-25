"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, X, ShoppingCart } from "lucide-react"
import { useRouter } from "next/navigation"

type OrderNotification = {
  id: string
  orderId: string | number
  buyerName: string
  amount: number
  timestamp: string
  isNew: boolean
}

export function OrderNotification() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") return

    const fetchAndMerge = async () => {
      try {
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: user.ishyigaAccount }),
          cache: "no-store",
        })
        const json = await res.json()
        if (json?.ok && json.orders) {
          const recent: OrderNotification[] = json.orders
            .filter((order: any) => {
              const t = new Date(order.CREATED_AT || order.createdAt || 0).getTime()
              return t > Date.now() - 24 * 60 * 60 * 1000
            })
            .map((order: any): OrderNotification => ({
              id: `notif-${order.ID_ORDER}`,
              orderId: order.ID_ORDER,
              buyerName: order.BUYER_OWNER || order.buyerName || "Customer",
              amount: Number(order.AMOUNT || order.total || 0),
              timestamp: String(order.CREATED_AT || order.createdAt || new Date().toISOString()),
              isNew: true,
            }))

          setNotifications(prev => {
            const existing = new Set(prev.map(n => String(n.orderId)))
            const deduped = recent.filter(o => !existing.has(String(o.orderId)))
            return [...deduped, ...prev].slice(0, 5)
          })
        }
      } catch (error) {
        console.error("Failed to fetch order notifications:", error)
      }
    }

    // poll every 30s + run once immediately
    const interval = setInterval(fetchAndMerge, 30000)
    fetchAndMerge()
    return () => clearInterval(interval)
  }, [isAuthenticated, user?.role, user?.ishyigaAccount])

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isNew: false } : n))
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const newCount = notifications.filter(n => n.isNew).length
  if (!isAuthenticated || user?.role !== "supplier" || notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button variant="outline" size="sm" onClick={() => setShowNotifications(!showNotifications)} className="relative">
        <Bell className="h-4 w-4" />
        {newCount > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
            {newCount}
          </Badge>
        )}
      </Button>

      {showNotifications && (
        <Card className="absolute top-12 right-0 w-80 max-h-96 overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Recent Orders
              <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`p-3 rounded-lg border ${n.isNew ? "bg-blue-50 border-blue-200" : "bg-gray-50"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="font-medium text-sm">Order #{n.orderId}</span>
                      {n.isNew && <Badge variant="default" className="text-xs">New</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.buyerName}</p>
                    <p className="text-sm font-semibold">{n.amount.toLocaleString()} RWF</p>
                    <p className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        router.push(`/supplier/orders/${n.orderId}`)
                        markAsRead(n.id)
                        setShowNotifications(false)
                      }}
                    >
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeNotification(n.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => router.push("/supplier/orders")}>
              View All Orders
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
