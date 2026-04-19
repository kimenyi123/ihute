# Category AI browse: performance notes

## Current behaviour

1. **`listSuppliersWithProducts` (one call)**  
   Used to build the **shop grid** and tab badges (**N** shops, **I** catalog lines) on `/category_ai/[sector]`.  
   This returns suppliers **with nested `products[]`** — good: **no N+1** per supplier for the initial payload.

2. **“Choose an item”**  
   `ProductGrid` runs **another** `listSuppliersWithProducts` to flatten all products for cards, sort, and family chips.  
   So the category page can do **two** identical sector fetches (cache-friendly if Next/Java Redis is warm).

## Recommendations

- **Short term:** Keep `limit=500` (or tune in Java). Rely on **Redis** on `fetchSuggestions` to absorb repeat visits.
- **Next improvement:** Pass the **already-fetched** sector JSON from `CategoryClientAI` into `ProductGrid` as `initialSellersPayload` so **item mode** does not refetch.
- **Header search:** Today, hiding the in-page search means **text search** for products on that page is via the **global header** only if you wire it (e.g. navigate to `/search?sector=pharmacy&q=…` or lift query into context). Until then, users rely on **family** + **sort** on the category page.
- **Heavy search:** Avoid per-keystroke calls that loop all suppliers. Prefer **one** sector-scoped `globalSearch` with `sector=` (already used by `ProductGrid`’s inline search) or a dedicated Java endpoint with LIMIT.

## Location filter

Shop grid uses **prefs-store `location`** (header) as a soft filter when “All areas” is selected, plus an explicit **Area** dropdown for the sector list.
