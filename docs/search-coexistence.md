# How header “Search products” and the Global Search page coexist

There are **two search entry points** that share the same backend and can work together.

---

## 1. Header search (“Search products…”)

- **Where:** In the header on every page: the main search input next to Location and Filters.
- **Component:** `GlobalSearch` (`components/global-search.tsx`) with placeholder e.g. “Search products…”.
- **Behavior:**
  - User types → suggestions load from the same API as the search page (`/api/fetchSuggestions` with `globalSearch`, etc.).
  - User can pick a product or supplier → navigate to product, cart, or **/search** with the query in the URL.
  - So the header is a **quick search** that can send the user to the full search page with a pre-filled query.

---

## 2. Search page (“Global Search”)

- **Where:** `/search` — the page titled “Global Search” with its own search input and filters (location, sector, etc.).
- **Behavior:**
  - Has its own input that also calls the same suggestion/search API.
  - Reads URL params (`q`, `sector`, `supplier`, `district`, `cell`, `priceMin`, `priceMax`, …) so:
    - **Direct link:** e.g. `/search?q=beer` shows results for “beer”.
    - **From header:** If the header navigates to `/search?q=...`, the search page shows that query and results.
  - Offers extra filters (sector, location, supplier) and product list + supplier list.

---

## How they coexist

| Aspect | Header search | Search page |
|--------|----------------|-------------|
| **Role** | Quick search from any page | Full search + filters + results |
| **API** | Same `fetchSuggestions` (globalSearch) | Same + sector/location params |
| **Navigation** | Can go to `/search?q=...` or to product/cart | Stays on `/search` and updates URL |
| **URL** | Can set `q` (and optionally other params) when opening search | Reads and writes `q`, `sector`, `priceMin`, etc. |

So:

- **Header** = one search box everywhere; can open the search page with a query.
- **Search page** = same search logic + filters + results; URL is the source of truth.

Implementation details:

- **Header:** `GlobalSearch` submits or navigates to `/search` with the current query (and can pass sector/shopBy from the product filters store if you wire it).
- **Search page:** Uses `useSearchParams()` for `q`, `sector`, etc., and runs the same (or same-style) fetch with those params.

There is no conflict: one is a shortcut that can land on the other; both use the same backend and the same URL params on `/search`.
