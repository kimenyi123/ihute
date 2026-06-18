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

const LOCAL_JAVA_BACKEND_DEFAULT = "http://localhost:8082/Trading"

/** NEXT_PUBLIC_API_URL is often set to frontend origin; only use it for Java proxying when it clearly targets Trading. */
function looksLikeJavaTradingBase(raw: string): boolean {
  const t = noTrailingSlash(raw.trim())
  if (!t) return false
  try {
    const u = new URL(t)
    const path = u.pathname.toLowerCase()
    if (path.includes("/trading")) return true
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true
    if (u.port === "8080" || u.port === "8082") return true
    return false
  } catch {
    return /trading/i.test(t)
  }
}

function getExplicitBackendBase(): string {
  const backendUrl = process.env.BACKEND_URL?.trim() || ""
  const javaBackendBase = process.env.npm ?.trim() || ""
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || ""
  return javaBackendBase || backendUrl || (looksLikeJavaTradingBase(publicApiUrl) ? publicApiUrl : "")
}

/**
 * Same URL resolution as {@link getBackendBase}; used by server API routes that proxy to Java.
 * Prefer {@link getBackendBase} in new code; kept for imports from merged branches.
 */
export function getServerProxyBackendBase(): string {
  return getBackendBaseForProxy()
}

/**
 * Java backend base URL (no trailing slash).
 * Priority: `JAVA_BACKEND_BASE` → `BACKEND_URL` → `NEXT_PUBLIC_API_URL` (when it looks like Trading),
 * then local / production defaults. Prefer JAVA_BACKEND_BASE so a stale root `.env` BACKEND_URL=8082
 * does not override `.env.local` Tomcat on 8080.
 */
export function getBackendBase(): string {
  const explicit = getExplicitBackendBase()

  let raw: string
  if (explicit) {
    raw = noTrailingSlash(explicit)
  } else if (process.env.NODE_ENV === "development") {
    raw = LOCAL_JAVA_BACKEND_DEFAULT
  } else {
    raw = "https://ihute.rw/Trading"
  }

  try {
    const u = new URL(raw)
    const path = u.pathname.replace(/\/+$/, "") || ""
    if (path === "" || path === "/") {
      u.pathname = process.env.NODE_ENV === "development" ? "/trading_ai" : "/Trading"
      return noTrailingSlash(u.toString())
    }
    return noTrailingSlash(u.toString())
  } catch {
    return raw
  }
}

/** Cached when {@link warmJavaBackendBase} finds Tomcat (see port/context sweep). */
let resolvedJavaBackendBase: string | null = null
let warmJavaBackendInFlight: Promise<void> | null = null
let cachedValidJavaAuthEndpoint: string | null = null
let authEndpointValidationInFlight: Promise<string | null> | null = null

/**
 * Base URL for server-side Java proxies after {@link warmJavaBackendBase} (falls back to {@link getBackendBase}).
 */
export function getBackendBaseForProxy(): string {
  if (getExplicitBackendBase()) {
    return getBackendBase()
  }
  return resolvedJavaBackendBase ?? getBackendBase()
}

function buildJavaBackendBaseCandidates(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (raw: string) => {
    const t = noTrailingSlash((raw || "").trim())
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  add(getBackendBase())

  const extra = (process.env.JAVA_BACKEND_PROBE_BASES || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const e of extra) add(e)

  if (getExplicitBackendBase()) {
    return out
  }

  try {
    const u = new URL(getBackendBase())
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    if (!local) return out

    const proto = u.protocol
    const host = u.hostname
    const hosts = new Set<string>([host])
    if (host === "localhost") hosts.add("127.0.0.1")
    if (host === "127.0.0.1") hosts.add("localhost")
    const ports = new Set<number>()
    if (u.port) ports.add(parseInt(u.port, 10))
    for (const p of [8082, 8080, 8081]) ports.add(p)
    const envPorts = (process.env.JAVA_BACKEND_PROBE_PORTS || "")
      .split(/[,;\s]+/)
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
    for (const n of envPorts) ports.add(n)

    const contexts = ["Trading", "Ihute", "trading_ai", "Trading_beta", "trading_beta", "Trading_dev", "trading_dev"]
    for (const h of hosts) {
      for (const port of ports) {
        for (const ctx of contexts) {
          add(`${proto}//${h}:${port}/${ctx}`)
        }
        add(`${proto}//${h}:${port}`)
      }
    }
  } catch {
    /* ignore */
  }
  return out
}

function isGrandmaHomeHtml(text: string): boolean {
  const t = text.slice(0, 6000).toLowerCase()
  return t.includes("welcome to ishyiga") || t.includes("grandma buyer") || t.includes("kaos/user-auth")
}

function shortFetchSignal(): AbortSignal {
  try {
    return AbortSignal.timeout(1800)
  } catch {
    const c = new AbortController()
    setTimeout(() => c.abort(), 1800)
    return c.signal
  }
}

/**
 * Probes localhost Tomcat on common ports/contexts so {@link getBackendBaseForProxy} matches a running WAR.
 * Safe to call from every proxy route; runs at most once per process until cache cleared.
 */
export async function warmJavaBackendBase(_outerSignal?: AbortSignal): Promise<void> {
  if (resolvedJavaBackendBase) return
  if (warmJavaBackendInFlight) {
    await warmJavaBackendInFlight
    return
  }
  warmJavaBackendInFlight = (async () => {
    const candidates = buildJavaBackendBaseCandidates()
    for (const base of candidates) {
      const sig = shortFetchSignal()
      const hintUrl = `${base}/Kaos/deployment-hint`
      try {
        const r = await fetch(hintUrl, {
          method: "GET",
          cache: "no-store",
          signal: sig,
          headers: { Accept: "application/json" },
        })
        if (r.ok) {
          const j = (await r.json().catch(() => null)) as { base?: string } | null
          if (j && typeof j.base === "string" && j.base.trim()) {
            resolvedJavaBackendBase = noTrailingSlash(j.base.trim())
            return
          }
          resolvedJavaBackendBase = base
          return
        }
      } catch {
        /* try grandma */
      }
      try {
        const r2 = await fetch(`${base}/grandma`, {
          method: "GET",
          cache: "no-store",
          signal: shortFetchSignal(),
          headers: { Accept: "text/html,*/*" },
        })
        if (!r2.ok) continue
        const text = await r2.text()
        if (isGrandmaHomeHtml(text)) {
          resolvedJavaBackendBase = base
          return
        }
      } catch {
        /* next candidate */
      }
    }
  })()
  try {
    await warmJavaBackendInFlight
  } finally {
    warmJavaBackendInFlight = null
  }
}

/**
 * Tomcat missing servlet / wrong context — do not treat normal HTML pages (e.g. marketing) as this.
 */
export function isTomcatMissingServlet(text: string, status: number): boolean {
  if (status === 404 || status === 405) return true
  const head = text.slice(0, 2500).toLowerCase()
  if (head.includes("http status 404")) return true
  if (status >= 400 && status < 500 && head.includes("http status")) return true
  return false
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
    `${getBackendBaseForProxy()}/Kaos/OrdersServlet`
  return normalizeOrdersServletUrl(raw)
}

/** Java post_orders endpoint (XML transaction payload). */
export function getPostOrdersUrl(): string {
  return (
    process.env.JAVA_POST_ORDERS_URL ||
    `${getBackendBaseForProxy()}/post_orders`
  )
}

export function getSellerOrdersUrl(): string {
  return process.env.JAVA_SELLER_ORDERS_URL || `${getBackendBaseForProxy()}/Kaos/SellerOrdersServlet`
}

export function getSupplierUrl(): string {
  return process.env.JAVA_SUPPLIER_URL || `${getBackendBaseForProxy()}/SupplierServlet`
}

/** Supplier stock (for request-loan stock check). */
export function getSupplierStockUrl(): string {
  return process.env.JAVA_SUPPLIER_STOCK_URL || `${getBackendBaseForProxy()}/SupplierStock`
}

export function getDeliveryUrl(): string {
  return process.env.JAVA_DELIVERY_URL || `${getBackendBaseForProxy()}/DeliveryServlet`
}

export function getFetchSuggestionsUrl(): string {
  return process.env.JAVA_FETCH_SUGGESTIONS_URL || `${getBackendBaseForProxy()}/Kaos/fetchSuggestions`
}

/** Sector-only AND-token search (shops vs items); separate servlet from fetchSuggestions globalSearch. */
export function getSectorScopedSearchUrl(): string {
  return process.env.JAVA_SECTOR_SCOPED_SEARCH_URL || `${getBackendBaseForProxy()}/Kaos/sectorScopedSearch`
}

/** Sector shop grid JSON (sellers + sample products) — isolated from {@link getFetchSuggestionsUrl} for analysis. */
export function getSectorListSuppliersUrl(): string {
  return process.env.JAVA_SECTOR_LIST_SUPPLIERS_URL || `${getBackendBaseForProxy()}/Kaos/sectorListSuppliers`
}

/** Same servlet: GET ?sectorStats=pharmacy → JSON { ok, sector, shops, items } (full DB counts). */
export function getSectorStatsQuery(sectorSlug: string): string {
  return `sectorStats=${encodeURIComponent(sectorSlug.trim())}`
}

export function getShopWithMeUrl(): string {
  return process.env.JAVA_SHOP_WITH_ME_URL || `${getBackendBaseForProxy()}/shop_with_me`
}

export function getAuthUrl(): string {
  return process.env.JAVA_AUTH_URL || `${getBackendBaseForProxy()}/Kaos/user-auth`
}

function looksLikeHtmlResponse(text: string, contentType: string | null): boolean {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("text/html")) return true
  const head = text.slice(0, 2000).toLowerCase()
  return /<!doctype html|<html[\s>]|<body[\s>]/i.test(head) || /http status 404/i.test(head)
}

async function probeJavaAuthCandidate(candidate: string): Promise<boolean> {
  const form = new URLSearchParams()
  form.set("action", "login")
  form.set("email", "probe.invalid@example.test")
  form.set("password", "probe")

  const res = await fetch(candidate, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
    },
    body: form.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  })

  const text = await res.text()
  if (res.status === 404 || res.status === 405) return false

  if (looksLikeHtmlResponse(text, res.headers.get("content-type"))) return false

  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export async function resolveJavaAuthEndpointForReset(): Promise<string[]> {
  if (cachedValidJavaAuthEndpoint) return [cachedValidJavaAuthEndpoint]
  if (authEndpointValidationInFlight) return (await authEndpointValidationInFlight) ? [await authEndpointValidationInFlight] : getJavaAuthUrlCandidates()

  authEndpointValidationInFlight = (async () => {
    for (const candidate of getJavaAuthUrlCandidates()) {
      try {
        if (await probeJavaAuthCandidate(candidate)) {
          cachedValidJavaAuthEndpoint = candidate
          return candidate
        }
      } catch {
        /* keep trying */
      }
    }
    return null
  })()

  try {
    const candidate = await authEndpointValidationInFlight
    return candidate ? [candidate] : getJavaAuthUrlCandidates()
  } finally {
    authEndpointValidationInFlight = null
  }
}

/**
 * Tomcat may deploy this WAR as {@code /Trading}, {@code /Ihute}, or {@code /trading_ai}.
 * Login tries these in order until {@link isTomcatMissingServlet} is false.
 */
export function getJavaAuthUrlCandidates(): string[] {
  const primary = noTrailingSlash(getAuthUrl())
  const set = new Set<string>([primary])
  try {
    const u = new URL(primary)
    if (!u.pathname.toLowerCase().includes("/kaos/user-auth")) {
      return [primary]
    }
    const origin = `${u.protocol}//${u.host}`
    for (const ctx of ["Trading", "Ihute", "trading_ai"]) {
      set.add(noTrailingSlash(`${origin}/${ctx}/Kaos/user-auth`))
    }
    set.add(noTrailingSlash(`${origin}/Kaos/user-auth`))
  } catch {
    /* keep primary */
  }
  return [...set]
}

/** AdminServlet is mapped at WAR root `/AdminServlet` (not under `/Kaos/`). */
export function getAdminServletUrl(): string {
  return `${getBackendBase()}/AdminServlet`
}

/**
 * Grandma buyer POST — `grandmaAPIs.CreateBuyerServlet` at `/Api/grandma/buyers` (not `/grandma`).
 * Override with `GRANDMA_BUYER_API_URL` or point `BACKEND_URL` / `JAVA_BACKEND_BASE` at your Tomcat context.
 */
export function getGrandmaBuyerApiUrl(): string {
  if (process.env.GRANDMA_BUYER_API_URL) {
    return process.env.GRANDMA_BUYER_API_URL
  }
  return `${getBackendBaseForProxy()}/Api/grandma/buyers`
}

/** Grandma seller POST — `grandmaAPIs.CreateSellerServlet` at `/Api/grandma/sellers`. */
export function getGrandmaSellerApiUrl(): string {
  if (process.env.GRANDMA_SELLER_API_URL) {
    return process.env.GRANDMA_SELLER_API_URL
  }
  return `${getBackendBaseForProxy()}/Api/grandma/sellers`
}

/** Bulk stock lines for an existing Grandma seller — `POST` JSON `{ sellerAccount, lines }`. */
export function getGrandmaSellerStockApiUrl(): string {
  if (process.env.GRANDMA_SELLER_STOCK_API_URL) {
    return process.env.GRANDMA_SELLER_STOCK_API_URL
  }
  // Short path matches web.xml `/grandma/sellers/stock` (same servlet as `/Api/grandma/sellers/stock`).
  return `${getBackendBaseForProxy()}/grandma/sellers/stock`
}

/** S5/S6: `GET`/`POST` — list stock, search Niki, adjust quantity. */
export function getGrandmaSellerInventoryApiUrl(): string {
  if (process.env.GRANDMA_INVENTORY_API_URL) {
    return process.env.GRANDMA_INVENTORY_API_URL
  }
  // Short path: `/grandma/sellers/inventory` — same servlet as `/Api/grandma/sellers/inventory` (Kaos web.xml).
  // Some deployments/proxies only exercised the short mapping; Grandma home documents it for `/trading_ai`.
  return `${getBackendBaseForProxy()}/grandma/sellers/inventory`
}

/** Long path for the same inventory servlet if the short path404s (`null` when URL is fully overridden). */
export function getGrandmaSellerInventoryApiUrlFallback(): string | null {
  if (process.env.GRANDMA_INVENTORY_API_URL) {
    return null
  }
  return `${getBackendBaseForProxy()}/Api/grandma/sellers/inventory`
}

/** S7: `POST` — temp item + `PEND-{id}` stock row. */
export function getGrandmaSellerTempItemApiUrl(): string {
  if (process.env.GRANDMA_TEMP_ITEM_API_URL) {
    return process.env.GRANDMA_TEMP_ITEM_API_URL
  }
  return `${getBackendBaseForProxy()}/grandma/sellers/items/temp`
}

/**
 * Redis-first sector browse (same payload as `GET …/Kaos/sectorListSuppliers` / legacy `listSuppliersWithProducts`).
 * Short path `/grandma/suppliers/browse`; long `/Api/grandma/suppliers/browse`.
 */
export function getGrandmaListSuppliersBrowseUrl(): string {
  if (process.env.GRANDMA_LIST_SUPPLIERS_URL) {
    return process.env.GRANDMA_LIST_SUPPLIERS_URL
  }
  return `${getBackendBaseForProxy()}/grandma/suppliers/browse`
}

export function getGrandmaListSuppliersBrowseUrlFallback(): string | null {
  if (process.env.GRANDMA_LIST_SUPPLIERS_URL) {
    return null
  }
  return `${getBackendBaseForProxy()}/Api/grandma/suppliers/browse`
}

/** Account profile (account_signup): GET by email/account, PUT to update. */
export function getAccountProfileUrl(): string {
  return process.env.JAVA_ACCOUNT_PROFILE_URL || `${getBackendBaseForProxy()}/Api/AccountProfile`
}
/** Umusada Excel upload – proxies to Java backend when UMUSADA_EXCEL_USE_JAVA_BACKEND=true */
export function getUmusadaExcelUrl(): string {
  return process.env.JAVA_UMUSADA_EXCEL_URL || `${getBackendBaseForProxy()}/UmusadaExcelServlet`
}

/**
 * Seller registration POST JSON (InsertSuppliers servlet).
 * Production ihute.rw serves this at `/Trading/InsertSuppliers` (GET → 400 = mapped).
 * `/Trading/Api/InsertSuppliers` returns 404 there — do not use as default.
 * Override with JAVA_SUPPLIERS_URL if your WAR uses another path.
 */
export function getSuppliersUrl(): string {
  return process.env.JAVA_SUPPLIERS_URL || `${getBackendBaseForProxy()}/InsertSuppliers`
}
export function getOrderStatusUrl(): string {
  return process.env.JAVA_ORDER_STATUS_URL || `${getBackendBaseForProxy()}/OrderStatusServlet`
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
 * Java servlet for Umuriro payment create/health (GET/POST JSON).
 * Override with `JAVA_UMURIRO_PAYMENT_URL` or `UMURIRO_PAYMENT_URL` if your WAR uses another path.
 */
export function getUmuriroPaymentUrl(): string {
  const explicit =
    process.env.JAVA_UMURIRO_PAYMENT_URL?.trim() ||
    process.env.UMURIRO_PAYMENT_URL?.trim()
  if (explicit) return noTrailingSlash(explicit)
  return `${getBackendBaseForProxy()}/Kaos/UmuriroPaymentServlet`
}

/**
 * Public API base for client-side fetch (e.g. table commands, payment dashboard).
 * Same as backend base in most setups; override with NEXT_PUBLIC_API_URL if different.
 */
export function getPublicApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL
  if (explicit && String(explicit).trim()) {
    return noTrailingSlash(String(explicit).trim())
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8080/trading_ai"
  }
  return "https://ihute.rw/Trading"
}
