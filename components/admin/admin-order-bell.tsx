"use client"

import { useState } from "react"
import Link from "next/link"
import { Bell, ChevronRight, Loader2, ShoppingBag } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAdminOrderFeed } from "@/hooks/use-admin-order-feed"
import {
  formatAdminCurrency,
  formatOrderTimeRelative,
  orderNeedsAttention,
  type AdminMonitorOrder,
} from "@/lib/admin-order-monitor"

function OrderNotifRow({ order, isNew }: { order: AdminMonitorOrder; isNew: boolean }) {
  const label = order.orderNumber || `#${order.id}`
  const attention = orderNeedsAttention(order)

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="group flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
        <ShoppingBag className="h-4 w-4 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          {isNew ? (
            <span className="shrink-0 rounded border border-slate-300 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-slate-600">
              New
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-600">
          {order.buyerName || "Guest"} → {order.sellerName || "Seller"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatAdminCurrency(order.amount)}
          {order.paymentStatus ? ` · ${order.paymentStatus}` : ""}
          {" · "}
          {formatOrderTimeRelative(order.timestamp)}
        </p>
        {attention ? (
          <p className="mt-1 text-[11px] text-slate-500">Needs follow-up — seller may not have seen this</p>
        ) : null}
      </div>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
    </Link>
  )
}

export function AdminOrderBell() {
  const [open, setOpen] = useState(false)
  const { recentOrders, unreadOrders, unreadCount, attentionCount, loading, markAllRead, refresh } =
    useAdminOrderFeed(true)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      void refresh()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={`Order notifications${unreadCount > 0 ? `, ${unreadCount} new` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-slate-900 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,380px)] p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">New orders</p>
            <p className="text-xs text-slate-500">Live feed across all shops</p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-600"
              onClick={markAllRead}
            >
              Mark read
            </Button>
          ) : null}
        </div>

        {attentionCount > 0 ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <Link
              href="/admin/orders?attentionOnly=1"
              className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900"
              onClick={() => setOpen(false)}
            >
              <span>{attentionCount} order{attentionCount === 1 ? "" : "s"} need follow-up</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {loading && recentOrders.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No recent orders</p>
          ) : (
            recentOrders.map((order) => (
              <OrderNotifRow
                key={order.id}
                order={order}
                isNew={unreadOrders.some((u) => u.id === order.id)}
              />
            ))
          )}
        </div>

        <div className="border-t border-slate-200 p-2">
          <Link
            href="/admin/orders"
            className={cn(
              "flex w-full items-center justify-center rounded-md py-2 text-sm font-medium text-slate-700",
              "hover:bg-slate-50",
            )}
            onClick={() => {
              markAllRead()
              setOpen(false)
            }}
          >
            Open Order Monitor
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
