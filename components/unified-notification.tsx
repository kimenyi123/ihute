"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, X, ShoppingCart, Pin, PinOff, Star, Wallet } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { RatingModal } from "./RatingModal"
import { sellerAccountFromOrder, sellerNameFromOrder } from "@/lib/order-seller-account"
import { cn } from "@/lib/utils"
import { mapBackendOrderStatusToTrack, type TrackOrderStatus } from "@/lib/order-status-map"

type OrderNotification = {
  id: string
  type: "order"
  orderId: string | number
  buyerName: string
  amount: number
  timestamp: string
  isNew: boolean
  status: TrackOrderStatus
  statusLabel: string
}

type RatingNotification = {
  id: number
  type: "rating"
  title: string
  message: string
  actionUrl: string
  notificationType: string
  createdAt: number
  isRead: boolean
}

type UrubutoNotification = {
  id: number
  type: "urubuto"
  message: string
  action: string
  createdAt: string
  isRead: boolean
}

type UnifiedNotification = OrderNotification | RatingNotification | UrubutoNotification

const SELLER_NOTIF_DISMISSED_KEY = "ihute-seller-dismissed-notifs"

type DismissedNotifStore = { orders: string[]; urubuto: number[] }

function loadDismissedNotifs(): DismissedNotifStore {
  if (typeof window === "undefined") return { orders: [], urubuto: [] }
  try {
    const raw = localStorage.getItem(SELLER_NOTIF_DISMISSED_KEY)
    if (!raw) return { orders: [], urubuto: [] }
    const parsed = JSON.parse(raw) as DismissedNotifStore
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders.map(String) : [],
      urubuto: Array.isArray(parsed.urubuto) ? parsed.urubuto : [],
    }
  } catch {
    return { orders: [], urubuto: [] }
  }
}

function saveDismissedNotifs(store: DismissedNotifStore) {
  if (typeof window === "undefined") return
  localStorage.setItem(SELLER_NOTIF_DISMISSED_KEY, JSON.stringify(store))
}

function dismissOrderNotif(orderId: string) {
  const store = loadDismissedNotifs()
  const id = String(orderId)
  if (!store.orders.includes(id)) {
    store.orders.push(id)
    saveDismissedNotifs(store)
  }
}

// Minimal shape we expect from the backend
type RawOrder = {
  ID_ORDER?: string | number
  BUYER_OWNER?: string
  BUYER_NAMES?: string
  BUYER_ISHYIGA_ACCOUNT?: string
  buyerName?: string
  AMOUNT?: number
  total?: number
  heure?: unknown
  HEURE?: unknown
  CREATED_AT?: unknown
  createdAt?: unknown
  ORDER_STATUS?: string
  orderStatus?: string
  status?: string
  STATUS?: string
  PAYMENT_STATUS?: string
  paymentStatus?: string
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

function fmt(ts: string | number) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts)
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

function getOrderStatusLabel(status: TrackOrderStatus): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "open":
      return "Open"
    case "processing":
      return "Processing"
    case "invoice":
      return "Invoice"
    case "in-transit":
      return "Out for Delivery"
    case "delivered":
      return "Delivered"
    default:
      return "Open"
  }
}

function getOrderStatusBadgeClass(status: TrackOrderStatus): string {
  switch (status) {
    case "delivered":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    case "in-transit":
      return "bg-sky-100 text-sky-800 hover:bg-sky-100"
    case "invoice":
      return "bg-violet-100 text-violet-800 hover:bg-violet-100"
    case "processing":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100"
    case "pending":
      return "bg-slate-100 text-slate-800 hover:bg-slate-100"
    case "open":
    default:
      return "bg-blue-100 text-blue-800 hover:bg-blue-100"
  }
}

export function UnifiedNotification() {
  const { user, isAuthenticated, hasHydrated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(true)
  const [pinned, setPinned] = useState(true)
  const [ratingModalOpen, setRatingModalOpen] = useState(false)
  const [ratingData, setRatingData] = useState<{
    orderId: string
    sellerId: string
    sellerName: string
    items: Array<{ code: string; name: string }>
  } | null>(null)

  // Restore pinned/open state
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sellerNotifPinned") : null
    if (saved != null) {
      const v = saved === "1"
      setPinned(v)
      setShowNotifications(v)
    }
  }, [])

  // Persist pinned state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sellerNotifPinned", pinned ? "1" : "0")
    }
  }, [pinned])

  // Clear Urubuto items from bell when marked read on /supplier/urubuto
  useEffect(() => {
    const onUrubutoRead = () => {
      setNotifications((prev) => prev.filter((n) => n.type !== "urubuto"))
    }
    window.addEventListener("ihute-urubuto-notifications-read", onUrubutoRead)
    return () => window.removeEventListener("ihute-urubuto-notifications-read", onUrubutoRead)
  }, [])

  // Fetch order notifications
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || user?.role !== "supplier") return

    const controller = new AbortController()

    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: user.ishyigaAccount }),
          cache: "no-store",
          signal: controller.signal,
        })
        const json = await res.json()

        if (json?.ok && Array.isArray(json.orders)) {
          const raw: RawOrder[] = json.orders as RawOrder[]
          const dismissed = loadDismissedNotifs()

          const recent: OrderNotification[] = raw
            .map((order: RawOrder): OrderNotification | null => {
              const tsMs = toEpochMs(order.heure ?? order.HEURE ?? order.CREATED_AT ?? order.createdAt)
              if (tsMs == null) return null
              const buyerName = getBuyerName(order)
              const rawOrderStatus =
                order.ORDER_STATUS ??
                order.orderStatus ??
                order.status ??
                order.STATUS
              const rawPaymentStatus = order.PAYMENT_STATUS ?? order.paymentStatus
              const payStatus = String(rawPaymentStatus ?? "").trim().toUpperCase()
              if (payStatus === "PAID" || payStatus === "COMPLETED") {
                return null
              }
              const status = mapBackendOrderStatusToTrack(
                rawOrderStatus ? String(rawOrderStatus) : undefined,
                rawPaymentStatus ? String(rawPaymentStatus) : undefined,
              )
              const orderId = String(order.ID_ORDER ?? "")
              return {
                id: `order-${orderId}`,
                type: "order",
                orderId: order.ID_ORDER ?? "",
                buyerName,
                amount: Number(order.AMOUNT ?? order.total ?? 0),
                timestamp: new Date(tsMs).toISOString(),
                isNew: !dismissed.orders.includes(orderId),
                status,
                statusLabel: getOrderStatusLabel(status),
              }
            })
            .filter((x: OrderNotification | null): x is OrderNotification => x !== null)
            .filter((n: OrderNotification) => n.isNew)
            .filter((n: OrderNotification) => new Date(n.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000)
            .sort((a: OrderNotification, b: OrderNotification) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            .slice(0, 5)

          setNotifications((prev) => {
            const other = prev.filter((n): n is RatingNotification | UrubutoNotification => n.type !== "order")
            if (pinned && recent.length > 0) {
              setShowNotifications(true)
            }
            return [...recent, ...other].sort((a, b) => {
              const aTime =
                a.type === "order"
                  ? new Date(a.timestamp).getTime()
                  : a.type === "rating"
                    ? a.createdAt
                    : new Date(a.createdAt).getTime()
              const bTime =
                b.type === "order"
                  ? new Date(b.timestamp).getTime()
                  : b.type === "rating"
                    ? b.createdAt
                    : new Date(b.createdAt).getTime()
              return bTime - aTime
            }).slice(0, 10)
          })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Failed to fetch order notifications:", err)
      }
    }

    const interval = setInterval(fetchOrders, 30000)
    fetchOrders()
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [hasHydrated, isAuthenticated, user?.role, user?.ishyigaAccount, pinned])

  // Fetch rating notifications
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return

    const controller = new AbortController()

    const fetchRatings = async () => {
      try {
        const userEmail = user?.email || user?.ishyigaAccount
        if (!userEmail) return

        const res = await fetch(`/api/notifications/unread?userId=${encodeURIComponent(userEmail)}`, {
          signal: controller.signal,
        })
        const data = await res.json()

        if (data.ok && Array.isArray(data.notifications)) {
          // Only keep rating-related backend notifications in this supplier popup.
          // Generic order updates are represented by the supplier order cards above.
          const ratingNotifs: RatingNotification[] = data.notifications
            .filter((n: any) => {
              const notificationType = String(n?.type ?? "").toLowerCase()
              const actionUrl = String(n?.actionUrl ?? "")
              return notificationType.includes("rating") || actionUrl.includes("/products/rate")
            })
            .map((n: any) => ({
            id: n.id,
            type: "rating" as const,
            title: n.title,
            message: n.message,
            actionUrl: n.actionUrl,
            notificationType: n.type,
            createdAt: n.createdAt,
            isRead: false,
          }))

          setNotifications((prev) => {
            const other = prev.filter((n): n is OrderNotification | UrubutoNotification => n.type !== "rating")
            const seen = new Set(prev.filter((n): n is RatingNotification => n.type === "rating").map((n) => n.id))
            const deduped = ratingNotifs.filter((n) => !seen.has(n.id))
            
            if (pinned && deduped.length > 0) {
              setShowNotifications(true)
            }
            
            return [...other.filter((n) => n.type === "order" || n.type === "urubuto"), ...deduped].sort((a, b) => {
              const aTime =
                a.type === "order"
                  ? new Date(a.timestamp).getTime()
                  : a.type === "rating"
                    ? a.createdAt
                    : new Date(a.createdAt).getTime()
              const bTime =
                b.type === "order"
                  ? new Date(b.timestamp).getTime()
                  : b.type === "rating"
                    ? b.createdAt
                    : new Date(b.createdAt).getTime()
              return bTime - aTime
            }).slice(0, 10)
          })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Failed to fetch rating notifications:", err)
      }
    }

    const interval = setInterval(fetchRatings, 30000)
    fetchRatings()
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [hasHydrated, isAuthenticated, user, pinned])

  // Urubuto onboarding / live notifications (supplier)
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || user?.role !== "supplier" || !user?.ishyigaAccount) return

    const controller = new AbortController()

    const fetchUrubuto = async () => {
      try {
        const account = user.ishyigaAccount?.trim()
        if (!account) return
        const res = await fetch(
          `/api/supplier/urubuto/notifications?account=${encodeURIComponent(account)}&limit=8&unreadOnly=1`,
          { signal: controller.signal },
        )
        const data = await res.json()
        if (!data.ok || !Array.isArray(data.notifications)) return

        const urubutoNotifs: UrubutoNotification[] = data.notifications
          .filter((n: { isRead?: boolean }) => !n.isRead)
          .map((n: {
            id: number
            message?: string
            action?: string
            createdAt?: string
            isRead?: boolean
          }) => ({
            id: n.id,
            type: "urubuto" as const,
            message: n.message || "UrubutoPay update",
            action: n.action || "",
            createdAt: n.createdAt || new Date().toISOString(),
            isRead: false,
          }))

        setNotifications((prev) => {
          const orders = prev.filter((x): x is OrderNotification => x.type === "order")
          const ratings = prev.filter((x): x is RatingNotification => x.type === "rating")
          if (pinned && urubutoNotifs.length > 0) {
            setShowNotifications(true)
          }
          return [...orders, ...ratings, ...urubutoNotifs].sort((a, b) => {
            const aTime =
              a.type === "order"
                ? new Date(a.timestamp).getTime()
                : a.type === "rating"
                  ? a.createdAt
                  : new Date(a.createdAt).getTime()
            const bTime =
              b.type === "order"
                ? new Date(b.timestamp).getTime()
                : b.type === "rating"
                  ? b.createdAt
                  : new Date(b.createdAt).getTime()
            return bTime - aTime
          }).slice(0, 10)
        })
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Failed to fetch Urubuto notifications:", err)
      }
    }

    const interval = setInterval(fetchUrubuto, 45000)
    fetchUrubuto()
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [hasHydrated, isAuthenticated, user?.role, user?.ishyigaAccount, pinned])

  const markAsRead = async (notification: UnifiedNotification) => {
    if (notification.type === "order") {
      dismissOrderNotif(String(notification.orderId))
      setNotifications((prev) => prev.filter((n) => n.type !== "order" || n.id !== notification.id))
    } else if (notification.type === "urubuto") {
      const account = user?.ishyigaAccount?.trim()
      if (account) {
        await fetch("/api/supplier/urubuto/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, notificationIds: [notification.id] }),
        }).catch(() => undefined)
      }
      setNotifications((prev) => prev.filter((n) => n.type !== "urubuto" || n.id !== notification.id))
    } else {
      try {
        const userEmail = user?.email || user?.ishyigaAccount
        if (!userEmail) return

        await fetch(`/api/notifications/${notification.id}/read?userId=${encodeURIComponent(userEmail)}`, {
          method: "POST",
        })

        setNotifications((prev) => prev.filter((n) => n.type !== "rating" || n.id !== notification.id))
      } catch (err) {
        console.error("Failed to mark rating as read:", err)
      }
    }
  }

  const handleNotificationClick = async (notification: UnifiedNotification) => {
    if (notification.type === "order") {
      await markAsRead(notification)
      router.push(`/supplier/orders/${notification.orderId}`)
      if (!pinned) setShowNotifications(false)
    } else if (notification.type === "urubuto") {
      await markAsRead(notification)
      router.push("/supplier/urubuto")
      if (!pinned) setShowNotifications(false)
    } else {
      // Handle rating notification
      if (notification.actionUrl && notification.actionUrl.includes('/products/rate')) {
        const urlParams = new URLSearchParams(notification.actionUrl.split('?')[1])
        const orderId = urlParams.get('orderId')

        if (orderId) {
          try {
            const userEmail = user?.email || user?.ishyigaAccount
            const res = await fetch(`/api/orders/details?orderId=${orderId}&userEmail=${encodeURIComponent(userEmail || '')}`)
            const data = await res.json()

            if (data.ok && data.order) {
              setRatingData({
                orderId: orderId,
                sellerId: sellerAccountFromOrder(data.order),
                sellerName: sellerNameFromOrder(data.order),
                items: data.order.items || [],
              })
              setRatingModalOpen(true)
            }
          } catch (error) {
            console.error('Failed to fetch order details:', error)
          }
        }
        markAsRead(notification)
        if (!pinned) setShowNotifications(false)
      } else if (notification.actionUrl) {
        router.push(notification.actionUrl)
        markAsRead(notification)
        if (!pinned) setShowNotifications(false)
      }
    }
  }

  const removeNotification = (notification: UnifiedNotification) => {
    setNotifications((prev) =>
      prev.filter((n) => {
        if (notification.type === "order") return n.type !== "order" || n.id !== notification.id
        if (notification.type === "rating") return n.type !== "rating" || n.id !== notification.id
        return n.type !== "urubuto" || n.id !== notification.id
      }),
    )
  }

  const visibleNotifications = notifications.filter((n) =>
    n.type === "order" ? n.isNew : n.type === "urubuto" ? !n.isRead : !n.isRead,
  )

  const newCount = visibleNotifications.length

  // Always show the bell for authenticated suppliers
  if (!isAuthenticated) return null

  const isSupplierRoute = pathname?.startsWith("/supplier")

  return (
    <>
      <div
        className={cn(
          "fixed right-4 z-50",
          // Keep the floating bell below supplier header/hamburger.
          isSupplierRoute ? "top-20" : "top-4",
        )}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative"
          title="Show notifications"
        >
          <Bell className="h-4 w-4" />
          {newCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {newCount}
            </Badge>
          )}
        </Button>

        {showNotifications && (
          <Card className="absolute top-12 right-0 w-[min(20rem,calc(100vw-2rem))] max-h-96 overflow-y-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  Notifications
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
              {visibleNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No notifications</p>
                  <p className="text-sm mt-1">You're all caught up!</p>
                </div>
              ) : (
                <>
                  {visibleNotifications.map((n) => (
                <div
                  key={n.type === "order" ? n.id : n.type === "rating" ? `rating-${n.id}` : `urubuto-${n.id}`}
                  className={`p-3 rounded-lg border cursor-pointer ${
                    (n.type === "order" && n.isNew) ||
                    ((n.type === "rating" || n.type === "urubuto") && !n.isRead)
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50"
                  }`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {n.type === "order" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            <span className="font-medium text-sm">Order #{n.orderId}</span>
                            {n.isNew && <Badge variant="default" className="text-xs">New</Badge>}
                            <Badge variant="secondary" className={cn("text-xs", getOrderStatusBadgeClass(n.status))}>
                              {n.statusLabel}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{n.buyerName}</p>
                          <p className="text-sm font-semibold">{n.amount.toLocaleString()} RWF</p>
                          <p className="text-xs text-gray-500">{fmt(n.timestamp)}</p>
                        </>
                      ) : n.type === "rating" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-sm">{n.title}</span>
                            {!n.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                          <p className="text-xs text-gray-500">{fmt(n.createdAt)}</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-violet-600" />
                            <span className="font-medium text-sm">UrubutoPay</span>
                            {!n.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                          <p className="text-xs text-gray-500">{fmt(n.createdAt)}</p>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeNotification(n)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => router.push(user?.role === "supplier" ? "/supplier/orders" : "/notifications")}
              >
                View All
              </Button>
            </>
          )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rating Modal */}
      {ratingData && (
        <RatingModal
          open={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false)
            setRatingData(null)
          }}
          onSuccess={() => {
            setRatingModalOpen(false)
            setRatingData(null)
          }}
          orderId={ratingData.orderId}
          sellerId={ratingData.sellerId}
          sellerName={ratingData.sellerName}
          buyerPhone={user?.phone}
          items={ratingData.items}
        />
      )}
    </>
  )
}
