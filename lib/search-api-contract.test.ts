import assert from "node:assert/strict"
import test from "node:test"
import {
  buildSearchError,
  classifySearchUpstreamFailure,
  normalizeSearchSuccess,
} from "./search-api-contract"
import { getBackendBase, getFetchSuggestionsUrl } from "./backend-config"

test("valid empty search is a canonical successful response", () => {
  const result = normalizeSearchSuccess(
    { products: [], suppliersByName: [], suppliersByProduct: [] },
    "missing product",
  )

  assert.equal(result?.ok, true)
  assert.equal(result?.query, "missing product")
  assert.deepEqual(result?.products, [])
})

test("malformed success payload is rejected", () => {
  assert.equal(
    normalizeSearchSuccess({ products: [] }, "broken response"),
    null,
  )
  assert.equal(
    normalizeSearchSuccess({ products: [], suppliersByName: [], suppliersByProduct: "bad" }, "broken response"),
    null,
  )
})

test("timeout and unreachable failures have stable non-success classifications", () => {
  const timeout = classifySearchUpstreamFailure(
    Object.assign(new Error("aborted"), { name: "AbortError" }),
    "milk",
  )
  assert.equal(timeout.status, 504)
  assert.equal(timeout.body.ok, false)
  assert.equal(timeout.body.error.code, "SEARCH_BACKEND_TIMEOUT")

  const unavailable = classifySearchUpstreamFailure(new Error("connection refused"), "milk")
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.body.ok, false)
  assert.equal(unavailable.body.error.code, "SEARCH_BACKEND_UNAVAILABLE")
})

test("backend URL keeps the WAR context and explicit servlet override", () => {
  const original = {
    JAVA_BACKEND_BASE: process.env.JAVA_BACKEND_BASE,
    BACKEND_URL: process.env.BACKEND_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    JAVA_FETCH_SUGGESTIONS_URL: process.env.JAVA_FETCH_SUGGESTIONS_URL,
  }

  try {
    process.env.JAVA_BACKEND_BASE = "https://example.test/Trading_dev/"
    delete process.env.BACKEND_URL
    delete process.env.NEXT_PUBLIC_API_URL
    delete process.env.JAVA_FETCH_SUGGESTIONS_URL
    assert.equal(getBackendBase(), "https://example.test/Trading_dev")
    assert.equal(getFetchSuggestionsUrl(), "https://example.test/Trading_dev/Kaos/fetchSuggestions")

    process.env.JAVA_FETCH_SUGGESTIONS_URL = "https://example.test/Trading_dev/Kaos/fetchSuggestions/"
    assert.equal(getFetchSuggestionsUrl(), "https://example.test/Trading_dev/Kaos/fetchSuggestions")

    process.env.JAVA_BACKEND_BASE = "https://example.test"
    delete process.env.JAVA_FETCH_SUGGESTIONS_URL
    assert.throws(() => getBackendBase(), /WAR context path/)
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("error envelope is safe and stable", () => {
  const failure = buildSearchError(
    "SEARCH_INVALID_UPSTREAM_RESPONSE",
    "BAD_GATEWAY",
    "Search service returned an invalid response.",
    "milk",
  )
  assert.deepEqual(failure, {
    ok: false,
    query: "milk",
    error: {
      code: "SEARCH_INVALID_UPSTREAM_RESPONSE",
      category: "BAD_GATEWAY",
      message: "Search service returned an invalid response.",
    },
  })
})
