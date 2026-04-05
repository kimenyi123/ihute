/**
 * Central backend API configuration from .env / .env.local.
 * Base URL resolution: BACKEND_URL → JAVA_BACKEND_BASE → NEXT_PUBLIC_API_URL →
 * NEXT_PUBLIC_BACKEND_URL → JAVA_BASE_URL → NEXT_PUBLIC_API_BASE → default https://ihute.rw/Trading
 * Optional full-URL overrides (ignore BACKEND_URL if set): JAVA_FETCH_SUGGESTIONS_URL, JAVA_SHOP_WITH_ME_URL, …
 */

function noTrailingSlash(s: string): string {
  return (s || "").replace(/\/+$/, "")
}

/** First non-empty wins (order matters). Add common names people put in .env.local by mistake. */
const BACKEND_BASE_ENV_KEYS = [
  "BACKEND_URL",
  "JAVA_BACKEND_BASE",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "JAVA_BASE_URL",
  "NEXT_PUBLIC_API_BASE",
] as const

let backendBaseDevLogged = false
let servletOverridesDevLogged = false

function logServletOverridesOnce() {
  if (process.env.NODE_ENV !== "development" || servletOverridesDevLogged) return
  servletOverridesDevLogged = true
  if (process.env.JAVA_FETCH_SUGGESTIONS_URL?.trim()) {
    console.warn(
      "[backend-config] JAVA_FETCH_SUGGESTIONS_URL is set — /api/fetchSuggestions uses this full URL, not BACKEND_URL:",
      process.env.JAVA_FETCH_SUGGESTIONS_URL.trim()
    )
  }
  if (process.env.JAVA_SHOP_WITH_ME_URL?.trim()) {
    console.warn(
      "[backend-config] JAVA_SHOP_WITH_ME_URL is set — /api/shop-with-me uses this, not BACKEND_URL:",
      process.env.JAVA_SHOP_WITH_ME_URL.trim()
    )
  }
}

function resolveBackendBase(): { base: string; source: string } {
  for (const key of BACKEND_BASE_ENV_KEYS) {
    const raw = process.env[key]
    if (raw != null && String(raw).trim() !== "") {
      return { base: noTrailingSlash(String(raw).trim()), source: key }
    }
  }
  return { base: noTrailingSlash("https://ihute.rw/Trading"), source: "(default ihute.rw — set BACKEND_URL in .env.local)" }
}

/**
 * Java backend base URL (no trailing slash).
 * Reads BACKEND_URL, JAVA_BACKEND_BASE, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_BACKEND_URL, JAVA_BASE_URL, NEXT_PUBLIC_API_BASE.
 * In development, logs once which key was used (restart `next dev` after editing .env.local).
 */
export function getBackendBase(): string {
  const { base, source } = resolveBackendBase()
  if (process.env.NODE_ENV === "development" && !backendBaseDevLogged) {
    backendBaseDevLogged = true
    console.log(`[backend-config] Java API base: ${base}`)
    console.log(`[backend-config] Source env: ${source}`)
    logServletOverridesOnce()
  }
  return base
}

/** Optional override or derived from base. */
export function getOrdersUrl(): string {
  return (
    process.env.JAVA_ORDERS_URL ||
    process.env.JAVA_SERVLET_URL ||
    `${getBackendBase()}/Kaos/OrdersServlet`
  )
}

/** Java post_orders endpoint (XML transaction payload). */
export function getPostOrdersUrl(): string {
  return (
    process.env.JAVA_POST_ORDERS_URL ||
    `${getBackendBase()}/post_orders`
  )
}

export function getSellerOrdersUrl(): string {
  return process.env.JAVA_SELLER_ORDERS_URL || `${getBackendBase()}/Kaos/SellerOrdersServlet`
}

export function getSupplierUrl(): string {
  return process.env.JAVA_SUPPLIER_URL || `${getBackendBase()}/SupplierServlet`
}

/** Supplier stock (for request-loan stock check). */
export function getSupplierStockUrl(): string {
  return process.env.JAVA_SUPPLIER_STOCK_URL || `${getBackendBase()}/SupplierStock`
}

export function getDeliveryUrl(): string {
  return process.env.JAVA_DELIVERY_URL || `${getBackendBase()}/DeliveryServlet`
}

export function getFetchSuggestionsUrl(): string {
  const base = getBackendBase()
  const override = process.env.JAVA_FETCH_SUGGESTIONS_URL?.trim()
  return override || `${base}/Kaos/fetchSuggestions`
}

export function getShopWithMeUrl(): string {
  const base = getBackendBase()
  const override = process.env.JAVA_SHOP_WITH_ME_URL?.trim()
  return override || `${base}/shop_with_me`
}

export function getAuthUrl(): string {
  return process.env.JAVA_AUTH_URL || `${getBackendBase()}/Kaos/user-auth`
}

/** Account profile (account_signup): GET by email/account, PUT to update. */
export function getAccountProfileUrl(): string {
  return process.env.JAVA_ACCOUNT_PROFILE_URL || `${getBackendBase()}/Api/AccountProfile`
}
/** Umusada Excel upload – proxies to Java backend when UMUSADA_EXCEL_USE_JAVA_BACKEND=true */
export function getUmusadaExcelUrl(): string {
  return process.env.JAVA_UMUSADA_EXCEL_URL || `${getBackendBase()}/UmusadaExcelServlet`
}

export function getSuppliersUrl(): string {
  return process.env.JAVA_SUPPLIERS_URL || `${getBackendBase()}/Api/InsertSuppliers`
}
export function getOrderStatusUrl(): string {
  return process.env.JAVA_ORDER_STATUS_URL || `${getBackendBase()}/OrderStatusServlet`
}

/** For server-side proxy timeouts (ms). */
export function getProxyTimeoutMs(): number {
  return Number(process.env.PROXY_TIMEOUT_MS ?? 12000)
}

/**
 * Public site URL for links (order page, track-order, etc.).
 * Use NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_API_URL so deployment can override.
 */
export function getPublicSiteUrl(): string {
  return noTrailingSlash(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw"
  )
}

/**
 * Public API base for client-side fetch (e.g. table commands, payment dashboard).
 * Same as backend base in most setups; override with NEXT_PUBLIC_API_URL if different.
 */
export function getPublicApiUrl(): string {
  return noTrailingSlash(process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw/Trading")
}
