/**
 * Central backend API configuration from .env / .env.local.
 * One base is enough: set BACKEND_URL, JAVA_BACKEND_BASE, or NEXT_PUBLIC_API_URL
 * (e.g. http://64.225.66.239:8080/trading_ai or https://ihute.rw/Trading).
 * All servlet URLs (fetchSuggestions, shop_with_me, orders, etc.) are derived from this base.
 * Optional overrides: JAVA_ORDERS_URL, JAVA_FETCH_SUGGESTIONS_URL, JAVA_SHOP_WITH_ME_URL, etc.
 */

function noTrailingSlash(s: string): string {
  return (s || "").replace(/\/+$/, "")
}

/**
 * Java backend base URL (no trailing slash).
 * Uses BACKEND_URL, JAVA_BACKEND_BASE, or NEXT_PUBLIC_API_URL from env.
 *
 * The path segment must match Tomcat’s **context path** (the `webapps/<Context>` name):
 * `Trading.war` → `/Trading`; `trading_ai.war` → `/trading_ai`. If `.env.local` still says
 * `…/trading_ai` but you only deployed `Trading.war`, Grandma APIs 404 at `/trading_ai/Api/…`.
 */
export function getBackendBase(): string {
  const raw = noTrailingSlash(
    process.env.BACKEND_URL ||
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

/**
 * OrdersServlet is deployed under the Kaos web path, e.g. .../Trading/Kaos/OrdersServlet.
 * If JAVA_ORDERS_URL was set to .../Trading/OrdersServlet (missing Kaos), fix it so local .env mistakes still work.
 */
function normalizeOrdersServletUrl(url: string): string {
  const t = url.trim()
  if (!t || t.includes("/Kaos/OrdersServlet")) return t
  try {
    const u = new URL(t)
    const p = u.pathname
    if (p.endsWith("/OrdersServlet") && !p.includes("/Kaos/")) {
      u.pathname = `${p.slice(0, -"OrdersServlet".length)}Kaos/OrdersServlet`
      return u.toString()
    }
  } catch {
    /* not a full URL */
  }
  return t
}

/** Optional override or derived from base. */
export function getOrdersUrl(): string {
  const raw =
    process.env.JAVA_ORDERS_URL ||
    process.env.JAVA_SERVLET_URL ||
    `${getBackendBase()}/Kaos/OrdersServlet`
  return normalizeOrdersServletUrl(raw)
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

/** Sector-only AND-token search (shops vs items); separate servlet from fetchSuggestions globalSearch. */
export function getSectorScopedSearchUrl(): string {
  return process.env.JAVA_SECTOR_SCOPED_SEARCH_URL || `${getBackendBase()}/Kaos/sectorScopedSearch`
}

/** Sector shop grid JSON (sellers + sample products) — isolated from {@link getFetchSuggestionsUrl} for analysis. */
export function getSectorListSuppliersUrl(): string {
  return process.env.JAVA_SECTOR_LIST_SUPPLIERS_URL || `${getBackendBase()}/Kaos/sectorListSuppliers`
}

/** Same servlet: GET ?sectorStats=pharmacy → JSON { ok, sector, shops, items } (full DB counts). */
export function getSectorStatsQuery(sectorSlug: string): string {
  return `sectorStats=${encodeURIComponent(sectorSlug.trim())}`
}

export function getShopWithMeUrl(): string {
  return process.env.JAVA_SHOP_WITH_ME_URL || `${getBackendBase()}/shop_with_me`
}

export function getAuthUrl(): string {
  return process.env.JAVA_AUTH_URL || `${getBackendBase()}/Kaos/user-auth`
}

/**
 * Grandma buyer POST — `grandmaAPIs.CreateBuyerServlet` at `/Api/grandma/buyers` (not `/grandma`).
 * Override with `GRANDMA_BUYER_API_URL` or point `BACKEND_URL` / `JAVA_BACKEND_BASE` at your Tomcat context.
 */
export function getGrandmaBuyerApiUrl(): string {
  if (process.env.GRANDMA_BUYER_API_URL) {
    return process.env.GRANDMA_BUYER_API_URL
  }
  return `${getBackendBase()}/Api/grandma/buyers`
}

/** Grandma seller POST — `grandmaAPIs.CreateSellerServlet` at `/Api/grandma/sellers`. */
export function getGrandmaSellerApiUrl(): string {
  if (process.env.GRANDMA_SELLER_API_URL) {
    return process.env.GRANDMA_SELLER_API_URL
  }
  return `${getBackendBase()}/Api/grandma/sellers`
}

/** Bulk stock lines for an existing Grandma seller — `POST` JSON `{ sellerAccount, lines }`. */
export function getGrandmaSellerStockApiUrl(): string {
  if (process.env.GRANDMA_SELLER_STOCK_API_URL) {
    return process.env.GRANDMA_SELLER_STOCK_API_URL
  }
  // Short path matches web.xml `/grandma/sellers/stock` (same servlet as `/Api/grandma/sellers/stock`).
  return `${getBackendBase()}/grandma/sellers/stock`
}

/** S5/S6: `GET`/`POST` — list stock, search Niki, adjust quantity. */
export function getGrandmaSellerInventoryApiUrl(): string {
  if (process.env.GRANDMA_INVENTORY_API_URL) {
    return process.env.GRANDMA_INVENTORY_API_URL
  }
  // Short path: `/grandma/sellers/inventory` — same servlet as `/Api/grandma/sellers/inventory` (Kaos web.xml).
  // Some deployments/proxies only exercised the short mapping; Grandma home documents it for `/trading_ai`.
  return `${getBackendBase()}/grandma/sellers/inventory`
}

/** Long path for the same inventory servlet if the short path404s (`null` when URL is fully overridden). */
export function getGrandmaSellerInventoryApiUrlFallback(): string | null {
  if (process.env.GRANDMA_INVENTORY_API_URL) {
    return null
  }
  return `${getBackendBase()}/Api/grandma/sellers/inventory`
}

/** S7: `POST` — temp item + `PEND-{id}` stock row. */
export function getGrandmaSellerTempItemApiUrl(): string {
  if (process.env.GRANDMA_TEMP_ITEM_API_URL) {
    return process.env.GRANDMA_TEMP_ITEM_API_URL
  }
  return `${getBackendBase()}/grandma/sellers/items/temp`
}

/**
 * Redis-first sector browse (same payload as `GET …/Kaos/sectorListSuppliers` / legacy `listSuppliersWithProducts`).
 * Short path `/grandma/suppliers/browse`; long `/Api/grandma/suppliers/browse`.
 */
export function getGrandmaListSuppliersBrowseUrl(): string {
  if (process.env.GRANDMA_LIST_SUPPLIERS_URL) {
    return process.env.GRANDMA_LIST_SUPPLIERS_URL
  }
  return `${getBackendBase()}/grandma/suppliers/browse`
}

export function getGrandmaListSuppliersBrowseUrlFallback(): string | null {
  if (process.env.GRANDMA_LIST_SUPPLIERS_URL) {
    return null
  }
  return `${getBackendBase()}/Api/grandma/suppliers/browse`
}

/** Account profile (account_signup): GET by email/account, PUT to update. */
export function getAccountProfileUrl(): string {
  return process.env.JAVA_ACCOUNT_PROFILE_URL || `${getBackendBase()}/Api/AccountProfile`
}
/** Umusada Excel upload – proxies to Java backend when UMUSADA_EXCEL_USE_JAVA_BACKEND=true */
export function getUmusadaExcelUrl(): string {
  return process.env.JAVA_UMUSADA_EXCEL_URL || `${getBackendBase()}/UmusadaExcelServlet`
}

/** Seller registration POST JSON. Override JAVA_SUPPLIERS_URL if your WAR maps a different path (e.g. /InsertSupplier vs /Api/InsertSuppliers). */
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
