# fetchSuggestions: Evaluation & Optimized Fetch Proposal

This doc evaluates your current **fetchSuggestions** Java servlet (Redis + DB for shops, brands, sector, search) and proposes an **optimized fetch** for the new task: shops, items by brand, and more searches, with Redis-first and support for category/price filters.

**Note:** The files `niki_items.grab` and `seller_add_stock.grab` could not be read (binary). Table structures below are **inferred from fetchSuggestions.java**. You can paste DDL or column lists to align.

---

## 1. Current behaviour (from fetchSuggestions.java)

### 1.1 Redis keys (backend Java)

| Key pattern | Value | TTL | When populated |
|-------------|--------|-----|----------------|
| `supplier_<account>` | JSON array of items | 3600 s | On miss: query `seller_add_stock` by SELLER_ISHYIGA_ACCOUNT |
| `supplier_size_<account>` | `{"size":"N","isaha":"..."}` | 3600 s | Same request; returned to client for supplier view |
| `brand_<name>` | JSON array of items | 3600 s | On miss: query `niki_items` WHERE item_fabricant=name |
| `brand_size_<name>` | size + isaha | 3600 s | Same |
| `sector_<name>` | JSON array of items | 3600 s | On miss: query `niki_items` WHERE bus_category_id (or bar/resto combo) |
| `sector_size_<name>` | size + isaha | 3600 s | Same |
| `sector_stock_<sector>` | JSON array from **seller_add_stock** | **none** | On miss: query seller_add_stock WHERE sector=X, QUANTITY>0, SYNCED_TIME>date |

### 1.2 Tables inferred from Java

**seller_add_stock** (stock per seller):
- ITEM_CODE, ITEM_NAME, QUANTITY, SALE_PRICE_INCLUSIVE, SYNCED_TIME, DESCRIPTION_KEYWORD, IMITERERE, SELLER_ISHYIGA_ACCOUNT
- sector, CONDITIONS, BATCH, DATE_EXP, NIKI_CODE, unit (from manage_search_lucky)

**niki_items** (catalog / “brain”):
- item_commercial_name, item_emballage, item_packet, item_key_words
- item_fabricant (brand), bus_category_id (sector: BAR, RESTAURANT, SUPERMARKET, BOUTIQUE, PHARMACY, COFFEE-SHOP, LIQUOR STORE)

### 1.3 Request routing (doGet)

- `quick_product_code` + `querySupplierSELECTED` → manage_search_code (Redis `supplier_<id>`, find by item_code).
- `querySupplierSELECTED` → manage_supplier (Redis supplier_ / supplier_size_ → else DB seller_add_stock).
- `queryBrandSELECTED` → manage_Brand_sector("brand", …) (Redis brand_ / brand_size_ → else DB niki_items).
- `querySectorSELECTED` → manage_Brand_sector("sector", …) (Redis sector_ / sector_size_ → else DB niki_items).
- `selectedSector` + `queryLuckySELECTED` → manage_search_lucky (Redis sector_stock_<sector> → else DB seller_add_stock, then set Redis **without TTL**).
- `query` → manage_search (if supplier/brand/sector selected: get from Redis, filter in memory by words; else **no Redis**, direct SQL on niki_items with LIKE).

---

## 2. Evaluation of current approach

### What works well
- **Redis-first** for supplier, brand, sector: one DB hit per (account/brand/sector) per hour; then in-memory filter by query words.
- **Clear key naming:** supplier_, brand_, sector_, sector_stock_.
- **Unified path** for brand and sector in manage_Brand_sector (same pattern, different WHERE).

### Issues and risks
1. **sector_stock_ has no TTL**  
   `jedis.set("sector_stock_" + sector, ...)` — key never expires; data can stay stale. **Recommendation:** use `setex` (e.g. 3600 s like others).

2. **SQL injection**  
   Several queries build WHERE with string concatenation (e.g. sector, querySupplierSELECTED, name in manage_Brand_sector). **Recommendation:** use `PreparedStatement` and bind parameters.

3. **Typo in niki_items fallback**  
   `ORDER item_commercial_name BY LIMIT 100` is invalid; should be `ORDER BY item_commercial_name LIMIT 100`.

4. **Global search (no supplier/brand/sector) always hits DB**  
   When only `query` is set, code goes straight to niki_items with LIKE; no Redis. So high traffic on “global” search increases DB load. **Recommendation:** cache global search results in Redis keyed by normalized query (e.g. `search:<normalized_query>`) with short TTL.

5. **Param naming vs Next.js**  
   Next app sends e.g. `globalSearch`, `listSuppliersBySector`, `supplierProducts`, `category`, `priceMin`, `priceMax`. Your servlet uses `query`, `querySupplierSELECTED`, `querySectorSELECTED`, etc. Backend and Next may be different entry points; if they should be the same, align param names or add a thin adapter that maps Next params to your params.

6. **Brand/sector response**  
   manage_Brand_sector returns only `_size_` JSON (size + isaha) to the client, not the full list. If the frontend needs the list for “items by brand” or “items by sector”, either return the list in the same response or expose a separate endpoint that returns the list (and cache that in Redis).

7. **No category/price in Redis or DB path**  
   Filters (category, priceMin, priceMax) are not yet in your Redis key design or SQL. To support them without changing key layout too much, you can either: (a) add a **combined search** path that takes query + sector + category + brand + priceMin + priceMax and caches by full param set, or (b) keep existing keys and apply category/price filter in memory after loading from Redis (simpler but less optimal for large lists).

---

## 3. Proposed optimized fetch for the new task

Goal: **shops, items by brand, and more searches**, with Redis-first and optional category/price support.

### 3.1 Keep and fix current keys
- **supplier_<account>** — keep; ensure TTL (e.g. 3600). Use for “shop’s items” and for search when a supplier is selected.
- **supplier_size_<account>** — keep; same TTL.
- **brand_<name>** — keep; use for “items by brand”. Consider returning full list in one response (or second endpoint) so Next can show products; cache that response.
- **sector_<name>** — keep; use for “items by sector” from catalog (niki_items).
- **sector_stock_<sector>** — keep; add **TTL** (e.g. 3600). Use for “in-stock items in sector” from seller_add_stock.

Fix: sector_stock_ setex; all SQL via PreparedStatement; fix ORDER BY typo.

### 3.2 New or extended keys (optional but recommended)

- **search:global:<normalized_query>**  
  Cache result of global search (niki_items or seller_add_stock by text). Key = e.g. lowercased trimmed query, max length 100. TTL short (e.g. 300 s). Reduces DB load for repeated searches.

- **search:filtered:<hash(params)>**  
  When you add category, brand, priceMin, priceMax (and sector), one option is a single “filtered search” that:
  - Reads from Redis `sector_<sector>` or `brand_<brand>` (or both) if present,
  - Or runs one SQL joining seller_add_stock + niki_items with WHERE category/brand/price,
  - Caches result under a key that includes all filter params (e.g. hash of "sector=X&category=Y&brand=Z&priceMin=A&priceMax=B"). TTL e.g. 300 s.

That way “shops”, “items by brand”, and “more searches” can all be served from Redis when the same filters are requested again.

### 3.3 Single “unified” fetch for Next.js (recommended)

Next app currently calls one backend URL with many params (globalSearch, sector, category, brand, priceMin, priceMax, listSuppliersBySector, supplierProducts, etc.). To optimize:

1. **One entry point** in Java (e.g. one servlet or one method) that:
   - Reads: globalSearch (or query), sector, category, brand, priceMin, priceMax, supplier (account), and any “mode” (e.g. listSuppliersBySector vs listSuppliersWithProducts).
2. **Resolve mode:**
   - If **supplier** set → use Redis `supplier_<account>` (or DB on miss); optionally filter by category/price in memory; return products (+ optional size).
   - If **brand** set → use Redis `brand_<name>` (or DB niki_items on miss); optionally filter by category/price; return products.
   - If **sector** set (and “with products” mode) → use Redis `sector_stock_<sector>` or `sector_<sector>` (or DB on miss); optionally filter by category/price; return products + seller list.
   - If only **globalSearch** → use Redis `search:global:<query>` if present; else DB (niki_items and/or seller_add_stock), then setex; return products + suppliers.
3. **Category/price:**  
   - If backend has category/price columns (e.g. in niki_items or seller_add_stock), add them to the SQL WHERE and to the cache key so filtered results are cached.  
   - If not, filter in memory after loading from Redis (current approach for “query words” in manage_search).

### 3.4 Response shape for Next.js

Next app expects something like:
- `products`: array of items (item_commercial_name, item_key_words, selling_price or item_emballage, item_packet, supplier_account, supplier_name, …).
- `suppliersByName` / `suppliersByProduct`: for search results.
- Optional: `source: "redis"` | `"database"` so the app can show “from cache” vs “from DB”.

Your current manage_supplier returns only size (supplier_size_); manage_Brand_sector returns only size for brand/sector. For “items by brand” and “items by sector” to work with the same API the Next app uses, the backend should return the **full product list** in the same format as fetchSuggestions (e.g. products array). So either:
- Extend the response of the existing brand/sector path to include the list when a “withProducts” or “full” param is set, or
- Have Next call a dedicated “list products by brand/sector” endpoint that returns products and cache that in Redis (e.g. brand_<name> or sector_stock_<sector> already hold the list; just return them to the client instead of only size).

---

## 4. Summary: what to do next

1. **Fix in place:**  
   - Add TTL to `sector_stock_*` (setex, e.g. 3600).  
   - Use PreparedStatement for all dynamic parts (no concatenation in SQL).  
   - Fix niki_items ORDER BY typo.

2. **Optional cache:**  
   - Cache global search in Redis (`search:global:<query>`, TTL 300).

3. **Align with Next:**  
   - Ensure one path (or one servlet) receives globalSearch, sector, category, brand, priceMin, priceMax.  
   - Return `products` (and optionally suppliers) in the shape Next expects; for brand/sector, return the list from Redis (or DB on miss), not only size.

4. **Document real DDL:**  
   - Paste or add the real **seller_add_stock** and **niki_items** DDL (or column list) into `docs/backend-stock-and-niki-structure.md` (the .grab files were not readable). Then we can write exact SQL for category/price in that doc and in this servlet.

If you share the exact param names and response shape the Next app sends to fetchSuggestions, the next step is to map them to this optimized flow and add the unified fetch in Java (or a new servlet) that uses the Redis keys above and returns the expected JSON.
