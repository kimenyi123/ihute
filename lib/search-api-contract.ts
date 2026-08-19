export type SearchErrorCategory =
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "BAD_GATEWAY"
  | "INVALID_REQUEST"
  | "INTERNAL"

export type SearchErrorCode =
  | "SEARCH_BACKEND_UNAVAILABLE"
  | "SEARCH_BACKEND_TIMEOUT"
  | "SEARCH_INVALID_UPSTREAM_RESPONSE"
  | "SEARCH_INVALID_REQUEST"
  | "SEARCH_PROXY_FAILURE"

export type SearchError = {
  code: SearchErrorCode
  category: SearchErrorCategory
  message: string
}

export type SearchSuccess = {
  ok: true
  query: string
  products: unknown[]
  suppliersByName: unknown[]
  suppliersByProduct: unknown[]
  [key: string]: unknown
}

export type SearchFailure = {
  ok: false
  error: SearchError
  query?: string
}

export type SearchResponse = SearchSuccess | SearchFailure

const EMPTY_SEARCH_KEYS = ["products", "suppliersByName", "suppliersByProduct"] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function isSearchSuccess(value: unknown): value is SearchSuccess {
  if (!isRecord(value)) return false
  return value.ok === true && EMPTY_SEARCH_KEYS.every((key) => Array.isArray(value[key]))
}

export function normalizeSearchSuccess(value: unknown, query: string): SearchSuccess | null {
  if (!isRecord(value)) return null
  if (Array.isArray(value)) return null

  const products = Array.isArray(value.products) ? value.products : null
  const suppliersByName = Array.isArray(value.suppliersByName) ? value.suppliersByName : null
  const suppliersByProduct = Array.isArray(value.suppliersByProduct) ? value.suppliersByProduct : null
  if (!products || !suppliersByName || !suppliersByProduct) return null

  return {
    ...value,
    ok: true,
    query: typeof value.query === "string" ? value.query : query,
    products,
    suppliersByName,
    suppliersByProduct,
  }
}

export function buildSearchError(
  code: SearchErrorCode,
  category: SearchErrorCategory,
  message: string,
  query?: string,
): SearchFailure {
  return {
    ok: false,
    ...(query ? { query } : {}),
    error: { code, category, message },
  }
}

export function searchErrorResponse(
  status: number,
  error: SearchFailure,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  })
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value))
  }
  return new Response(JSON.stringify(error), { status, headers })
}

export function classifySearchUpstreamFailure(
  error: unknown,
  query?: string,
): { status: number; body: SearchFailure } {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      status: 504,
      body: buildSearchError(
        "SEARCH_BACKEND_TIMEOUT",
        "TIMEOUT",
        "Search service timed out.",
        query,
      ),
    }
  }
  return {
    status: 503,
    body: buildSearchError(
      "SEARCH_BACKEND_UNAVAILABLE",
      "UPSTREAM_UNAVAILABLE",
      "Search service is temporarily unavailable.",
      query,
    ),
  }
}
