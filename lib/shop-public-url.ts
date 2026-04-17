/**
 * Public URL for the Grandma / shop experience (back links from seller & rider signup).
 * Override with NEXT_PUBLIC_SHOP_URL. Defaults: local dev → localhost grandma route; prod → shop subdomain.
 */
export function getShopPublicUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SHOP_URL?.trim()
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === "development") return "http://localhost:3000/grandma"
  return "https://shop.ihute.rw"
}
