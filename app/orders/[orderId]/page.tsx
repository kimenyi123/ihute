"use client"

import { OrderDetailsView } from "@/components/order-details-view"

function pickAnyNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null || String(v).trim() === "") continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

export default function OrderDetailsPage() {
  return <OrderDetailsView variant="site" />
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string
  const user = useAuthStore((s) => s.user)

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [financingBusy, setFinancingBusy] = useState(false)

  useEffect(() => {
    if (!orderId) return

    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, buyerAccount: user?.ishyigaAccount || "" }),
        })

        const data = await response.json()

        if (response.ok && data.order) {
          setOrder(data.order)
        } else {
          setError(data.error || "Failed to load order details")
        }
      } catch (err) {
        console.error("Error fetching order:", err)
        setError("Failed to load order details. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, user?.ishyigaAccount])

  // If the viewer is the seller for this order, send them to the supplier order page (not buyer view with "Contact Seller")
  useEffect(() => {
    if (!order || !orderId) return
    const sellerAccount = (order.SELLER_ISHYIGA_ACCOUNT || "").toString().trim().toLowerCase()
    const userAccount = (user?.ishyigaAccount || "").toString().trim().toLowerCase()
    if (sellerAccount && userAccount && sellerAccount === userAccount) {
      router.replace(`/supplier/orders/${orderId}`)
    }
  }, [order, orderId, user?.ishyigaAccount, router])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatDate = (timestamp: number | string) => {
    try {
      const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp)
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "N/A"
    }
  }

  const sendWhatsApp = () => {
    if (!order) return
    const items = order.items.map((item) => {
      const name = item.ITEM_NAME || item.name
      const qty = item.QUANTITY || item.qty || 0
      const price = item.UNIT_PRICE || item.unitPrice || 0
      return `${name} x${qty} - ${(qty * price).toLocaleString()} RWF`
    }).join("\n")

    const message = `
📦 Order #${order.ID_ORDER}

🏪 Shop: ${order.SELLER_NAMES}
📍 Location: ${order.DELIVERY_LOCATION || order.BUYER_LOCATION}

📋 Items:
${items}

💰 Total: ${(order.AMOUNT || order.total || 0).toLocaleString()} ${order.CURRENCY}
💳 Payment: ${formatPaymentMethod(order.PAYMENT_NAME)}
📱 My Phone: ${order.BUYER_PHONE}

🔗 Order Details: ${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${orderId}
    `.trim()

    const phone = order.SELLER_PHONE?.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold text-red-900">Order Not Found</h2>
            <p className="text-red-700">{error || "This order does not exist."}</p>
            <Button onClick={() => router.push("/orders")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currency = order.CURRENCY || "RWF"
  const servedOrderAmount =
    pickAnyNum(order as unknown as Record<string, unknown>, "SERVED_AMOUNT", "servedAmount", "AMOUNT_SERVED") ??
    0
  const orderNote =
    String(
      (order as unknown as Record<string, unknown>).CONDITIONS ??
      (order as unknown as Record<string, unknown>).ORDER_NOTE ??
      (order as unknown as Record<string, unknown>).orderNote ??
      ""
    ).trim()

  const financed = isInvoiceFinanced(order.PAYMENT_STATUS)
  const canFinanceOrder = canRequestInvoiceFinancing(order.ORDER_STATUS, financed)

  const requestFinancing = async () => {
    if (!order || !canFinanceOrder || financingBusy) return
    const buyerAccount = (order.BUYER_ISHYIGA_ACCOUNT || user?.ishyigaAccount || "").trim()
    const sellerAccount = (order.SELLER_ISHYIGA_ACCOUNT || "").trim()
    const buyerTIN = (order as any).BUYER_TIN || ""
    const supplierTIN = (order as any).SELLER_TIN || ""
    if (!buyerAccount || !sellerAccount) {
      alert("Missing buyer or seller account for financing.")
      return
    }
    if (!confirm("Request financing for this order?")) return
    setFinancingBusy(true)
    try {
      const res = await fetch("/api/request-loan-with-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: String(order.ID_ORDER),
          buyerAccount,
          sellerAccount,
          buyerTIN,
          supplierTIN,
          invoiceAmount: order.AMOUNT || order.total || 0,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setOrder({
          ...order,
          PAYMENT_STATUS: "UMUSADA",
        })
        alert(result.message || "Invoice financing submitted.")
      } else {
        if (result.code === "DUPLICATE_INVOICE") {
          setOrder({
            ...order,
            PAYMENT_STATUS: order.PAYMENT_STATUS || "UMUSADA",
          })
        }
        alert(result.error || "Financing request failed.")
      }
    } catch (e: any) {
      alert(e?.message || "Financing request failed.")
    } finally {
      setFinancingBusy(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header — buyer view: who placed the order (anonymous or logged in) can see details and contact seller */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order #{order.ID_ORDER}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {formatDate(order.CREATED_AT || order.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track progress from placement to delivery, or contact the seller below if you need help.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href={`/track-order/${orderId}`}>
              <Truck className="h-4 w-4 mr-2" />
              Track order
            </Link>
          </Button>
          {order.SELLER_PHONE && (
            <Button onClick={sendWhatsApp} className="bg-[#25D366] hover:bg-[#20b05a]" title="Open WhatsApp to contact the seller">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact Seller
            </Button>
          )}
        </div>
      </div>

      {/* Seller & buyer details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Seller
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{order.SELLER_NAMES || "—"}</p>
            {order.SELLER_PHONE && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3" />
                {order.SELLER_PHONE}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Buyer & delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.BUYER_NAME || order.BUYER_OWNER || "—"}</p>
            {order.BUYER_PHONE && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3" />
                {order.BUYER_PHONE}
              </p>
            )}
            {(order.DELIVERY_LOCATION || order.BUYER_LOCATION) && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3" />
                {order.DELIVERY_LOCATION || order.BUYER_LOCATION}
              </p>
            )}
            {order.IS_TABLE_COMMAND && order.TABLE_NAME && (
              <p className="text-muted-foreground mt-1">
                Table: {order.TABLE_NAME}
                {order.TABLE_LOCATION ? ` · ${order.TABLE_LOCATION}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Item</th>
                <th className="px-4 py-2 border">Quantity</th>
                <th className="px-4 py-2 border">Served Qty</th>
                <th className="px-4 py-2 border">Requested Price</th>
                <th className="px-4 py-2 border">Served Price</th>
                <th className="px-4 py-2 border">Total Requested</th>
                <th className="px-4 py-2 border">Total Served</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const name = item.ITEM_NAME || item.name
                // ✅ Remove ORDERED_BY field - use buyer info from account_signup instead
                // const orderedBy = String((item as any).ORDERED_BY ?? "").trim() || "—"
                const qty = item.QUANTITY || item.qty || 0
                const servedQty =
                  pickAnyNum(item as unknown as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ??
                  qty
                const requestedPrice =
                  pickAnyNum(item as unknown as Record<string, unknown>, "REQUEST_PRICE", "requestPrice", "UNIT_PRICE", "unitPrice") ?? 0
                const servedPrice =
                  pickAnyNum(item as unknown as Record<string, unknown>, "UNITY_PRICE", "servedAmount", "SERVED_AMOUNT", "servedPrice", "UNIT_PRICE", "unitPrice") ?? 0
                const totalRequested = qty * requestedPrice
                const totalServed = servedQty * servedPrice
                return (
                  <tr key={idx}>
                    <td className="px-4 py-2 border">{name}</td>
                    <td className="px-4 py-2 border">{qty}</td>
                    <td className="px-4 py-2 border">{servedQty}</td>
                    <td className="px-4 py-2 border">{requestedPrice.toLocaleString()} {currency}</td>
                    <td className="px-4 py-2 border">{servedPrice.toLocaleString()} {currency}</td>
                    <td className="px-4 py-2 border font-semibold">{totalRequested.toLocaleString()} {currency}</td>
                    <td className="px-4 py-2 border font-semibold">{totalServed.toLocaleString()} {currency}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {(() => {
            const totals = order.items.reduce(
              (acc, item) => {
                const qty = Number(item.QUANTITY || item.qty || 0)
                const servedQty =
                  pickAnyNum(item as unknown as Record<string, unknown>, "CONFIRMED_RECEIVED_QTY", "SERVED_QTY", "servedQty", "CONFIRMED_QTY") ??
                  qty
                const requestedPrice =
                  pickAnyNum(item as unknown as Record<string, unknown>, "REQUEST_PRICE", "requestPrice", "UNIT_PRICE", "unitPrice") ?? 0
                const servedPrice =
                  pickAnyNum(item as unknown as Record<string, unknown>, "UNITY_PRICE", "servedAmount", "SERVED_AMOUNT", "servedPrice", "UNIT_PRICE", "unitPrice") ?? 0
                acc.requested += qty * requestedPrice
                acc.served += servedQty * servedPrice
                return acc
              },
              { requested: 0, served: 0 }
            )
            return (
              <div className="mt-4 space-y-1 text-right">
                <div className="text-sm text-slate-600">
                  Total Requested Price: {totals.requested.toLocaleString()} {currency}
                </div>
                <div className="text-sm text-slate-600">
                  Total Served Price: {totals.served.toLocaleString()} {currency}
                </div>
              </div>
            )
          })()}
          <div className="mt-4 space-y-1 text-right">
            <div className="text-lg font-bold">
              Total: {(order.AMOUNT || order.total || 0).toLocaleString()} {currency}
            </div>
            {orderNote && <div className="text-sm text-slate-600">Order Note: {orderNote}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Financing */}
      <div className="flex justify-end mb-6">
        <Button
          variant="default"
          disabled={!canFinanceOrder || financingBusy}
          onClick={requestFinancing}
        >
          {financingBusy ? "Submitting…" : financed ? "Financed" : "Finance Order"}
        </Button>
      </div>

      {/* Success Toast */}
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Copied to clipboard!
        </div>
      )}
    </div>
  )
}
