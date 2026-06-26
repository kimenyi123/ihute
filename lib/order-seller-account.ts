/** Extract seller Ishyiga account from order payloads (camelCase or backend UPPER_SNAKE). */
export function sellerAccountFromOrder(
  order: Record<string, unknown> | null | undefined,
  seller?: Record<string, unknown> | null,
): string {
  if (!order && !seller) return ""
  return String(
    order?.sellerAccount ??
      order?.SELLER_ISHYIGA_ACCOUNT ??
      order?.sellerId ??
      order?.SELLER_ACCOUNT ??
      seller?.ISHYIGA_ACCOUNT ??
      "",
  ).trim()
}

/** Extract display name for the seller from order payloads. */
export function sellerNameFromOrder(
  order: Record<string, unknown> | null | undefined,
  seller?: Record<string, unknown> | null,
): string {
  if (!order && !seller) return "Supplier"
  const name = String(
    order?.sellerName ??
      order?.SELLER_NAMES ??
      order?.SELLER_OWNER ??
      order?.seller ??
      seller?.OWNER ??
      "Supplier",
  ).trim()
  return name || "Supplier"
}

/** User-friendly message when rating submission fails. */
export function formatRatingSubmitError(error: unknown): string {
  const raw = String(error ?? "").trim()
  if (!raw) return "Something went wrong. Please try again."
  if (/selleraccount|missing seller/i.test(raw)) {
    return "We couldn't identify the seller for this order. Please try again from your order details page."
  }
  return raw
}
