# FetchSuggestions backend contract (Kaos/fetchSuggestions)

The frontend proxies all search/suggestion requests to the Kaos servlet. The **API must include in the results all items that are available in Redis**, even when they are **not** in NIKI. If an item is not on NIKI but is available in Redis, it must still appear in the response so the frontend can display it.

## Redis results must always be in the API response

**Kaos fetchSuggestions must:**

1. **Search Redis** for matching products/items (e.g. by `globalSearch`, `quick_product_code`, or other item-search params).
2. **Include every matching item that is in Redis in the API result**, whether or not that item exists in NIKI. So: **if the item is not on NIKI but is available in Redis, it should still come in the result and be displayed.**
3. You may also search NIKI and/or the database and merge results (e.g. NIKI + Redis + DB), but Redis hits must not be excluded just because the item is not in NIKI.

So: **items in Redis must be returned in the API; do not exclude them when the item is not on NIKI.**

## Query params

The frontend forwards all query parameters as-is and **always adds `includeRedis=1`** so the backend knows to include Redis catalog in the response. Params include `globalSearch`, `limit`, `Currency`, `sector`, `district`, `cell`, `includeRedis=1`, etc. Response format: `{ products, suppliersByName, suppliersByProduct, query, ... }`.

When the backend receives `includeRedis=1`, it must search Redis and **merge Redis matches into `products`** (and suppliers if applicable). For example, a search for `globalSearch=PAIDOTERAIN` with `sector=pharmacy` must return items like "PAIDOTERAIN TESTING" if they exist in Redis, otherwise users see no results even though the data is in Redis.
