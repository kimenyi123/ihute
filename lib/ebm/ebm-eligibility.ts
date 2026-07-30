import type { AdminOrderHeader } from "@/lib/ebm/types"

/** Orders eligible for automatic fiscalization after payment. */
export function isOrderEligibleForAutoEbm(order: AdminOrderHeader): boolean {
  const paid = String(order.paymentStatus ?? "").toUpperCase() === "PAID"
  const st = String(order.orderStatus ?? "").toUpperCase()
  const completed = ["DELIVERED", "COMPLETED", "INVOICE", "CLOSED"].includes(st)
  return paid && completed
}
