export type RegisterSurface = "grandma" | "web"

export function isGrandmaHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase()
  return h === "shop.ihute.rw" || h.startsWith("grandma.ihute.rw")
}

export function registerSurface(host: string): RegisterSurface {
  if (isGrandmaHost(host)) return "grandma"
  return "web"
}
