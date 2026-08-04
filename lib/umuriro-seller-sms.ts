import { getShopPublicUrl } from "@/lib/shop-public-url"
import { grandmaRegisterFormHref } from "@/lib/grandma-urls"

/** Shop origin for Grandma deep links (strip trailing `/grandma` from local default). */
function shopOriginForLinks(): string {
  const raw = getShopPublicUrl().replace(/\/+$/, "")
  return raw.replace(/\/grandma$/i, "") || "https://shop.ihute.rw"
}

/**
 * SMS to the shop phone when Umuriro is saved with a valid Rwandan seller number.
 * Copy per product request (Kinyarwanda).
 */
export function buildUmuriroSellerSmsBody(itemName: string, shopId: string): string {
  const name = (itemName || "igicuruzwa").trim().slice(0, 120)
  return buildUmuriroSellerSmsBodyFromLines([name], shopId)
}

/** SMS when buyer ordered multiple products in one Umuriro cart. */
export function buildUmuriroSellerSmsBodyFromLines(itemNames: string[], shopId: string): string {
  const names = itemNames.map((n) => (n || "").trim()).filter(Boolean)
  const summary =
    names.length === 0
      ? "ibicuruzwa"
      : names.length === 1
        ? names[0]!.slice(0, 120)
        : `${names.length} ibicuruzwa (${names
            .slice(0, 3)
            .map((n) => n.slice(0, 40))
            .join(", ")}${names.length > 3 ? "…" : ""})`
  const path = grandmaRegisterFormHref("seller", { shopId })
  const url = `${shopOriginForLinks()}${path}`

  const line1 = "Mukeneye ibindi bicuruzwa matubwira"
  const line2 =
    `Umukiriya wacu abaguriye "${summary}", mukeneye kumugurishaho ibindi bicuruzwa, uzuza bishyiremo kuri ${url} gusa`

  return `${line1}\n\n${line2}`
}
