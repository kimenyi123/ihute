"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Phone,
  Store,
  User,
  AlertTriangle,
} from "lucide-react"
import { postAdminApi } from "@/lib/admin-client"
import {
  attentionReasonLabel,
  buyerTrackHref,
  formatAdminCurrency,
  formatOrderCommission,
  formatOrderTime,
  getOrderAttentionReasons,
  getPaymentBadgeClass,
  getStatusBadgeClass,
  getStatusLabel,
  normalizeOrderStatus,
  whatsAppHref,
  deriveSellerFulfillment,
  sellerFulfillmentHint,
  sellerFulfillmentLabel,
  type AdminMonitorOrder,
} from "@/lib/admin-order-monitor"
import {
  CLIENT_ORDER_MONITOR_DB,
  decodeOrderMonitorDb,
  encodeOrderMonitorDb,
  orderMonitorDbLabel,
  readOrderMonitorDb,
  writeOrderMonitorDb,
  type OrderMonitorDb,
} from "@/lib/admin-order-db"
import { Button } from "@/components/ui/button"

type OrderDetail = AdminMonitorOrder & {
  sellerAccount?: string
  buyerAccount?: string
  taxes?: number
  orderStatus?: string
}

type OrderItem = {
  id: number
  itemCode: string
  itemName: string
  quantity: number
  unitPrice: number
  discountAmount?: number
  vatRate?: number
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = String(params.id ?? "")

  const [db, setDb] = useState<OrderMonitorDb>(CLIENT_ORDER_MONITOR_DB)
  const [dbReady, setDbReady] = useState(false)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = searchParams.get("db")
    const resolved = decodeOrderMonitorDb(fromQuery) ?? readOrderMonitorDb()
    setDb(resolved)
    writeOrderMonitorDb(resolved)
    setDbReady(true)
  }, [searchParams])

  const loadOrder = useCallback(async () => {
    if (!orderId || !dbReady) return
    try {
      setLoading(true)
      setError(null)
      const res = await postAdminApi({ action: "getOrderDetails", orderId, db })
      const data = await res.json()
      if (!data.ok || !data.order) {
        setError(data.error || "Order not found")
        setOrder(null)
        setItems([])
        return
      }
      const o = data.order as Record<string, unknown>
      setOrder({
        id: Number(o.id),
        orderNumber: String(o.orderNumber ?? ""),
        sellerName: String(o.sellerName ?? ""),
        sellerAccount: String(o.sellerAccount ?? ""),
        sellerPhone: String(o.sellerPhone ?? ""),
        buyerName: String(o.buyerName ?? ""),
        buyerPhone: String(o.buyerPhone ?? ""),
        buyerEmail: String(o.buyerEmail ?? ""),
        buyerAccount: String(o.buyerAccount ?? ""),
        amount: Number(o.amount ?? 0),
        taxes: Number(o.taxes ?? 0),
        status: String(o.orderStatus ?? o.status ?? ""),
        orderStatus: String(o.orderStatus ?? ""),
        paymentStatus: String(o.paymentStatus ?? ""),
        paymentName: String(o.paymentName ?? ""),
        paymentId: String(o.paymentId ?? ""),
        timestamp: String(o.timestamp ?? ""),
        deliveryLocation: String(o.deliveryLocation ?? ""),
        servedAmount: Number(o.servedAmount ?? 0),
        servedQtyTotal: Number(o.servedQtyTotal ?? 0),
        sellerFulfillment: o.sellerFulfillment as AdminMonitorOrder["sellerFulfillment"],
        commissionRate: o.commissionRate != null ? Number(o.commissionRate) : undefined,
        commissionEligible: o.commissionEligible === true,
        commissionAmount: o.commissionAmount != null ? Number(o.commissionAmount) : 0,
      })
      setItems((data.items ?? []) as OrderItem[])
    } catch {
      setError("Failed to load order")
    } finally {
      setLoading(false)
    }
  }, [orderId, db, dbReady])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const handleNotifySeller = async () => {
    if (!order) return
    setNotifying(true)
    setNotifyMsg(null)
    try {
      const res = await postAdminApi({ action: "notifySellerOrder", orderId: order.id, db })
      const data = await res.json()
      if (!data.ok) {
        setNotifyMsg(data.error || "Could not notify seller")
        return
      }
      setNotifyMsg(data.message || "Seller notified.")
    } catch {
      setNotifyMsg("Network error while notifying seller")
    } finally {
      setNotifying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order…
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href={`/admin/orders?db=${encodeURIComponent(encodeOrderMonitorDb(db))}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Order Monitor
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || "Order not found"}</div>
      </div>
    )
  }

  const normalizedStatus = normalizeOrderStatus(order)
  const attentionReasons = getOrderAttentionReasons(order)
  const fulfillment = deriveSellerFulfillment(order)
  const sellerWa = order.sellerPhone
    ? whatsAppHref(
        order.sellerPhone,
        `Hello ${order.sellerName}, IHUTE admin follow-up on order #${order.orderNumber || order.id} (${formatAdminCurrency(order.amount)}). Buyer: ${order.buyerName || "—"}. Please check your supplier dashboard.`,
      )
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/admin/orders?db=${encodeURIComponent(encodeOrderMonitorDb(db))}`}
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Order Monitor
          </Link>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Order detail</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {order.orderNumber || `#${order.id}`}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{formatOrderTime(order.timestamp)}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{orderMonitorDbLabel(db)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-slate-200">
            <Link href={buyerTrackHref(order.id)} target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Buyer tracking
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleNotifySeller}
            disabled={notifying}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {notifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bell className="mr-1.5 h-3.5 w-3.5" />}
            Notify seller
          </Button>
        </div>
      </div>

      {notifyMsg ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">{notifyMsg}</div>
      ) : null}

      {attentionReasons.length > 0 ? (
        <div className="rounded-md border border-slate-200 border-l-2 border-l-slate-900 bg-white p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
            <div>
              <p className="font-medium text-slate-900">Needs follow-up</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {attentionReasons.map((r) => (
                  <li key={r}>· {attentionReasonLabel(r)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Store className="h-5 w-5" />
            Seller
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Shop</dt>
              <dd className="font-medium text-gray-900">{order.sellerName || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Account</dt>
              <dd className="font-mono text-gray-800">{order.sellerAccount || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="flex items-center gap-2 text-gray-900">
                <Phone className="h-4 w-4 text-gray-400" />
                {order.sellerPhone || "—"}
                {sellerWa ? (
                  <a href={sellerWa} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    WhatsApp
                  </a>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <User className="h-5 w-5" />
            Buyer
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{order.buyerName || "Guest"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{order.buyerPhone || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{order.buyerEmail || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Account</dt>
              <dd className="font-mono text-gray-800">{order.buyerAccount || "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Payment & status</h2>
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Seller fulfillment</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{sellerFulfillmentLabel(fulfillment)}</p>
          <p className="mt-0.5 text-xs text-slate-600">{sellerFulfillmentHint(fulfillment)}</p>
          {(order.servedAmount ?? 0) > 0 || (order.servedQtyTotal ?? 0) > 0 ? (
            <p className="mt-2 text-xs text-slate-600">
              Served amount: {formatAdminCurrency(order.servedAmount ?? 0)}
              {(order.servedQtyTotal ?? 0) > 0 ? ` · Qty confirmed: ${order.servedQtyTotal}` : ""}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs uppercase text-gray-500">Amount</p>
            <p className="text-xl font-bold text-gray-900">{formatAdminCurrency(order.amount)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Commission</p>
            <p className="text-xl font-bold text-gray-900">{formatOrderCommission(order)}</p>
            {order.commissionEligible ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Rate {((Number(order.commissionRate) || 0) * 100).toFixed(3)}% · PAID
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Accrues only when payment is PAID</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Order status</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(normalizedStatus)}`}>
              {getStatusLabel(normalizedStatus)}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Payment</p>
            <p className="font-medium text-gray-900">{order.paymentName || "—"}</p>
            <span className={getPaymentBadgeClass(order.paymentStatus === "PAID")}>
              {order.paymentStatus || "—"}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Transaction ref</p>
            <p className="break-all font-mono text-sm text-gray-800">{order.paymentId || "—"}</p>
          </div>
        </div>
        {order.deliveryLocation ? (
          <div className="mt-4 flex items-start gap-2 text-sm text-gray-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>{order.deliveryLocation}</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Package className="h-5 w-5" />
            Line items ({items.length})
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No line items returned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Item</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Code</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Qty</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Unit price</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-3 text-gray-900">{item.itemName}</td>
                    <td className="px-6 py-3 font-mono text-gray-600">{item.itemCode}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{item.quantity}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatAdminCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {formatAdminCurrency(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/admin/orders?db=${encodeURIComponent(encodeOrderMonitorDb(db))}&sellerAccount=${encodeURIComponent(order.sellerAccount || "")}`,
            )
          }
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          More orders from this seller
        </button>
      </div>
    </div>
  )
}
