import { getPublicSiteUrl } from "@/lib/backend-config"

/** Base URL for marketing site (not the Java /Trading API path). */
function siteRootForLinks(): string {
  const raw = getPublicSiteUrl()
  return raw.replace(/\/Trading\/?$/i, "").replace(/\/+$/, "") || "https://ihute.rw"
}

/**
 * SMS to the shop phone when Umuriro is saved with a valid Rwandan seller number.
 * Copy per product request (Kinyarwanda).
 */
export function buildUmuriroSellerSmsBody(itemName: string, shopId: string): string {
  const name = (itemName || "igicuruzwa").trim().slice(0, 120)
  const url = `${siteRootForLinks()}/register/seller/${encodeURIComponent(shopId)}`

  const line1 = "Mukeneye ibindi bicuruzwa matubwira"
  const line2 =
    `Umukiriya wacu abaguriye "${name}", mukeneye kumugurishaho ibindi bicuruzwa, uzuza bishyiremo kuri ${url} gusa`

  return `${line1}\n\n${line2}`
}
