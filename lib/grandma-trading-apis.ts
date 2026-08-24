/**
 * Trading AI / Grandma WAR — version and URL matrix for docs and UI.
 * Tomcat welcome HTML: `{base}/grandma` (e.g. http://localhost:8080/trading_ai/grandma).
 */
import {
  getAccountProfileUrl,
  getAuthUrl,
  getBackendBase,
  getFetchSuggestionsUrl,
  getGrandmaBuyerApiUrl,
  getGrandmaListSuppliersBrowseUrl,
  getGrandmaListSuppliersBrowseUrlFallback,
  getGrandmaSellerApiUrl,
  getGrandmaSellerInventoryApiUrl,
  getGrandmaSellerInventoryApiUrlFallback,
  getGrandmaSellerStockApiUrl,
  getGrandmaSellerTempItemApiUrl,
  getSectorListSuppliersUrl,
} from "@/lib/backend-config"

/** WAR / servlet version; Tomcat `{base}/grandma` shows this and `GRANDMA_APP_VERSION` (see `lib/grandma-urls.ts`). */
export const GRANDMA_TRADING_AI_VERSION = "1.1.3" as const

/** Named endpoints for tracking — avoids scattering magic paths next to `fetchSuggestions`. */
export function getGrandmaTradingApiMatrix() {
  const base = getBackendBase()
  return {
    version: GRANDMA_TRADING_AI_VERSION,
    backendBase: base,
    welcomeHtml: `${base}/grandma`,
    buyersPost: getGrandmaBuyerApiUrl(),
    sellersPost: getGrandmaSellerApiUrl(),
    sellerStockPost: getGrandmaSellerStockApiUrl(),
    sellerInventory: getGrandmaSellerInventoryApiUrl(),
    sellerInventoryFallback: getGrandmaSellerInventoryApiUrlFallback(),
    tempItemPost: getGrandmaSellerTempItemApiUrl(),
    /** Redis-first browse; same shape as legacy `listSuppliersWithProducts`. */
    suppliersBrowseGet: getGrandmaListSuppliersBrowseUrl(),
    suppliersBrowseGetLong: getGrandmaListSuppliersBrowseUrlFallback(),
    /** Next proxies sector stats via `/api/fetchSuggestions?sectorStats=` → Kaos servlet. */
    fetchSuggestions: getFetchSuggestionsUrl(),
    sectorListSuppliersServlet: getSectorListSuppliersUrl(),
    userAuth: getAuthUrl(),
    accountProfile: getAccountProfileUrl(),
  } as const
}
