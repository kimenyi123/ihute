// /lib/orders-api.ts
export async function createCodOrder(payload: {
  buyerEmail: string
  buyerPhone?: string
  buyerLocation?: string
  sellerAccount: string
  reference?: string
  items: Array<{ name: string; qty: number; unitPrice: number; unit?: string }>
}) {
  const res = await fetch("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, paymentName: "PAY_ON_DELIVERY", paymentId: "", currency: "RWF" }),
  })
  return res.json()
}

export async function markOrderReceived(orderId: number | string) {
  const res = await fetch("/api/orders/mark-received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  })
  return res.json()
}

export async function rateOrder(orderId: number | string, stars: number, feedback?: string) {
  const res = await fetch("/api/orders/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, stars, feedback }),
  })
  return res.json()
}
