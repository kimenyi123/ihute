export type UmuriroGqInitial = {
  shopName?: string
  momoCode?: string
  gqTin?: string
  gqMrc?: string
  gqPayload?: string
}

export function resolveUmuriroGqInitial(input: {
  name?: string
  momo?: string
  tin?: string
  mrc?: string
  payload?: string
}): UmuriroGqInitial {
  const name = input.name?.trim()
  const momo = input.momo?.replace(/\D/g, "")
  const tin = input.tin?.trim()
  const mrc = input.mrc?.trim()
  const payload = input.payload?.trim()

  if (payload?.startsWith("GQ3|")) {
    const parts = payload.split("|")
    if (parts.length >= 5) {
      return {
        shopName: name || parts.slice(4).join("|"),
        momoCode: momo || parts[3].replace(/\D/g, ""),
        gqTin: tin || parts[1],
        gqMrc: mrc || parts[2],
        gqPayload: payload,
      }
    }
  }

  if (name || momo || tin || mrc || payload) {
    return { shopName: name, momoCode: momo, gqTin: tin, gqMrc: mrc, gqPayload: payload }
  }

  return {}
}
