/**
 * Central backend API configuration from .env / .env.local.
 * One base is enough for deployment: set NEXT_PUBLIC_API_URL or JAVA_BACKEND_BASE
 * (e.g. https://ihute.rw/Trading or http://localhost:8081/Trading).
 * Optional overrides: JAVA_ORDERS_URL, JAVA_SELLER_ORDERS_URL, JAVA_SUPPLIER_URL, JAVA_DELIVERY_URL, etc.
 */

function noTrailingSlash(s: string): string {
  return (s || "").replace(/\/+$/, "")
}

/** Java backend base URL (no trailing slash). Uses NEXT_PUBLIC_API_URL or JAVA_BACKEND_BASE from env. */
export function getBackendBase(): string {
  const raw = noTrailingSlash(
    process.env.JAVA_BACKEND_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://ihute.rw/Trading"
  )

  // Some local/dev env values point only to the Tomcat host (e.g. http://localhost:8080)
  // while the Java servlets live under the `/Trading` context path.
  // If the base is missing `/Trading`, append it so `/api/kiosk/*` routes resolve.
  if (!raw.toLowerCase().includes("/trading")) {
    return `${raw}/Trading`
  }
  return raw
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
  return process.env.JAVA_FETCH_SUGGESTIONS_URL || `${getBackendBase()}/Kaos/fetchSuggestions`
}

export function getShopWithMeUrl(): string {
  return process.env.JAVA_SHOP_WITH_ME_URL || `${getBackendBase()}/shop_with_me`
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
