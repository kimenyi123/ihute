/** Fired on `window` when a Grandma checkout completes (same tab or after navigation). */
export const GRANDMA_ORDER_PLACED_EVENT = "grandma:order-placed" as const

export type GrandmaOrderPlacedDetail = {
  orderId: string
}

export function notifyGrandmaOrderPlaced(orderId: string) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(
      new CustomEvent<GrandmaOrderPlacedDetail>(GRANDMA_ORDER_PLACED_EVENT, {
        detail: { orderId: String(orderId).trim() },
      }),
    )
  } catch {
    /* ignore */
  }
}
