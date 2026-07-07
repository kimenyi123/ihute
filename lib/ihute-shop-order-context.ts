/** Session context when buyer shops via /shop-with-me/{nickname} — used at checkout for order attribution. */
const STORAGE_KEY = "ihute_shop_order_ctx"

export type ShopOrderContext = {
  source: "shop_with_me"
  shopNickname: string
  sellerAccount?: string
  at: number
}

export function writeShopOrderContext(ctx: Omit<ShopOrderContext, "at" | "source"> & { source?: "shop_with_me" }): void {
  if (typeof window === "undefined") return
  const nick = (ctx.shopNickname ?? "").trim().toLowerCase()
  if (!nick) return
  const payload: ShopOrderContext = {
    source: "shop_with_me",
    shopNickname: nick,
    sellerAccount: ctx.sellerAccount?.trim() || undefined,
    at: Date.now(),
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function readShopOrderContext(maxAgeMs = 4 * 60 * 60 * 1000): ShopOrderContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ShopOrderContext
    if (!parsed?.shopNickname) return null
    if (parsed.at && Date.now() - parsed.at > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

export function clearShopOrderContext(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
