/**
 * Prefer account_seller.owner (shop name) over ishyiga_account codes like ALG000004104.
 */

export function looksLikeIshyigaAccount(value?: string | null): boolean {
  const s = (value ?? "").trim()
  if (!s) return false
  return /^[A-Z]{2,5}\d{6,}$/i.test(s)
}

export function sellerDisplayName(opts: {
  owner?: string | null
  supplierName?: string | null
  nickname?: string | null
  supplierAccount?: string | null
  fallback?: string
}): string {
  const account = (opts.supplierAccount ?? "").trim()
  const candidates = [opts.owner, opts.supplierName, opts.nickname]
  for (const c of candidates) {
    const t = (c ?? "").trim()
    if (!t) continue
    if (account && t.toLowerCase() === account.toLowerCase()) continue
    if (looksLikeIshyigaAccount(t)) continue
    return t
  }
  const named = (opts.supplierName ?? "").trim()
  if (named && (!account || named.toLowerCase() !== account.toLowerCase()) && !looksLikeIshyigaAccount(named)) {
    return named
  }
  return (opts.fallback ?? "Supplier").trim() || "Supplier"
}

export function sellerDisplayNameFromProduct(p: {
  owner?: string | null
  OWNER?: string | null
  supplier_name?: string | null
  nickname?: string | null
  supplier_account?: string | null
  fallback?: string
}): string {
  return sellerDisplayName({
    owner: p.owner ?? p.OWNER,
    supplierName: p.supplier_name,
    nickname: p.nickname,
    supplierAccount: p.supplier_account,
    fallback: p.fallback,
  })
}
