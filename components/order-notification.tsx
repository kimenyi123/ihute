"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, X, ShoppingCart, Pin, PinOff } from "lucide-react"
import { useRouter } from "next/navigation"

type OrderNotification = {
  id: string
  orderId: string | number
  buyerName: string
  amount: number
  timestamp: string // ISO
  isNew: boolean
}

// Minimal shape we expect from the backend
type RawOrder = {
  ID_ORDER?: string | number
  // ✅ make sure we only ever show BUYER info (not seller)
  BUYER_OWNER?: string
  BUYER_NAMES?: string
  BUYER_ISHYIGA_ACCOUNT?: string
  buyerName?: string

  AMOUNT?: number
  total?: number

  // timestamps (many possible shapes)
  heure?: unknown
  HEURE?: unknown
  CREATED_AT?: unknown
  createdAt?: unknown
}

function toEpochMs(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) return null
    const n = Number(s)
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.getTime()
  }
  return null
}

function fmt(tsISO: string) {
  const d = new Date(tsISO)
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function getBuyerName(o: {
  BUYER_OWNER?: string
  BUYER_NAMES?: string
  BUYER_ISHYIGA_ACCOUNT?: string
  buyerName?: string
}): string {
  return (
    o.BUYER_OWNER ??
    o.BUYER_NAMES ??
    o.buyerName ??
    o.BUYER_ISHYIGA_ACCOUNT ??
    "Customer"
  )
}

export function OrderNotification() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [notifications, setNotifications] = useState<OrderNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(true)
  const [pinned, setPinned] = useState(true)

  // restore pinned/open state
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sellerNotifPinned") : null
    if (saved != null) {
      const v = saved === "1"
      setPinned(v)
      setShowNotifications(v)
    }
  }, [])

  // persist pinned state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sellerNotifPinned", pinned ? "1" : "0")
    }
  }, [pinned])

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

        if (json?.ok && Array.isArray(json.orders)) {
          const raw: RawOrder[] = json.orders as RawOrder[]

          // map → filter nulls → last 24h → sort newest first
          const recent: OrderNotification[] = raw
            .map((order: RawOrder): OrderNotification | null => {
              const tsMs = toEpochMs(order.heure ?? order.HEURE ?? order.CREATED_AT ?? order.createdAt)
              if (tsMs == null) return null
              const buyerName = getBuyerName(order)
              return {
                id: `notif-${String(order.ID_ORDER ?? "")}`,
                orderId: order.ID_ORDER ?? "",
                buyerName,
                amount: Number(order.AMOUNT ?? order.total ?? 0),
                timestamp: new Date(tsMs).toISOString(), // store as ISO (always parseable)
                isNew: true,
              }
            })
            .filter((x: OrderNotification | null): x is OrderNotification => x !== null)
            .filter((n: OrderNotification) => new Date(n.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000)
            .sort((a: OrderNotification, b: OrderNotification) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )

          setNotifications((prev: OrderNotification[]) => {
            const seen = new Set(prev.map((n: OrderNotification) => String(n.orderId)))
            const deduped = recent.filter((n: OrderNotification) => !seen.has(String(n.orderId)))
            const merged = [...deduped, ...prev].slice(0, 5)

            // auto-open when new items arrive (if not pinned open already)
            if (!pinned && deduped.length > 0 && !showNotifications) {
              setShowNotifications(true)
            }
            return merged
          })
        }
      } catch (err) {
        console.error("Failed to fetch order notifications:", err)
      }
    }

    const interval = setInterval(fetchAndMerge, 30000)
    fetchAndMerge()
    return () => clearInterval(interval)
  }, [isAuthenticated, user?.role, user?.ishyigaAccount, pinned, showNotifications])

  const markAsRead = (id: string) => {
    setNotifications((prev: OrderNotification[]) =>
      prev.map((n: OrderNotification) => (n.id === id ? { ...n, isNew: false } : n))
    )
  }

  const removeNotification = (id: string) => {
    setNotifications((prev: OrderNotification[]) => prev.filter((n: OrderNotification) => n.id !== id))
  }

  const newCount = notifications.filter((n: OrderNotification) => n.isNew).length
  if (!isAuthenticated || user?.role !== "supplier" || notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => !pinned && setShowNotifications(!showNotifications)}
        className="relative"
        title={pinned ? "Notifications pinned" : "Show notifications"}
      >
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
            <CardTitle className="text-sm flex items-center justify-between w-full">
              <span className="flex items-center gap-2">
                Recent Orders
                {pinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPinned((p) => !p)}
                  title={pinned ? "Unpin panel" : "Pin panel"}
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => !pinned && setShowNotifications(false)}
                  disabled={pinned}
                  title={pinned ? "Panel is pinned" : "Close"}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map((n: OrderNotification) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border ${n.isNew ? "bg-blue-50 border-blue-200" : "bg-gray-50"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="font-medium text-sm">Order #{n.orderId}</span>
                      {n.isNew && <Badge variant="default" className="text-xs">New</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.buyerName}</p>
                    <p className="text-sm font-semibold">{n.amount.toLocaleString()} RWF</p>
                    <p className="text-xs text-gray-500">{fmt(n.timestamp)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        router.push(`/supplier/orders/${n.orderId}`)
                        markAsRead(n.id)
                        if (!pinned) setShowNotifications(false)
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
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => router.push("/supplier/orders")}
            >
              View All Orders
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
