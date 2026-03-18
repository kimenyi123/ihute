# Backend: Stock table & NIKI items structure

This doc describes the **table that contains stock** (`seller_add_stock`) and the **niki_items** structure (the brain where items are trained). Use it to align DB/Redis with the app and to add category/brand/price filtering. The app **caches fetched results in Redis** to optimize response time.

---

## Where we are (quick map)

| What | Where it lives | Role |
|------|----------------|------|
| **Stock** (who sells what, quantity, price) | `seller_add_stock` | One row per seller’s product line. Has `NIKI_CODE`, `ITEM_NAME`, `SALE_PRICE_INCLUSIVE`, `FAMILLE`, etc. |
| **Catalog / brain** (brand, category, sector per product) | `niki_items` | One row per product type. Has `niki_code`, `item_fabricant` (brand), `category_id`, `bus_category_id` (sector). |
| **Link** | `seller_add_stock.NIKI_CODE` = `niki_items.niki_code` | Join these when you need both “what’s in stock” and “brand/category/sector”. |
| **App filters** | UI: Sector, Category, Brand, Price | App uses **niki_items** fields when the API sends them (`item_fabricant`, `category_id`, `bus_category_id`). If the API doesn’t send them, the app falls back to guessing from product name (so e.g. only “Leffe 300ml Brune Beer” shows for Beer). |

**What you need to do so filtering works properly:**  
Your API (shop-with-me, fetchSuggestions, or whatever feeds the product list) should **join** `seller_add_stock` with `niki_items` on `NIKI_CODE = niki_code` and **include in each product** in the JSON: `item_fabricant`, `category_id`, `bus_category_id`. Then the app will show all beers when you pick “Category: Beer”, and all brands when you pick “Brand: Leffe”, not just the one whose name contains “beer”.

---

## 1. Table containing stock: `seller_add_stock`

**Schema:** `chaos_test.seller_add_stock`

| Column | Type | Description |
|--------|------|-------------|
| ID | INT NOT NULL | Row id |
| ITEM_NAME | VARCHAR(200) NOT NULL | Product name → map to `item_commercial_name` |
| ITEM_CODE | VARCHAR(200) NOT NULL | Item code → `item_code` |
| DISCOUNT | DOUBLE PRECISION DEFAULT 0 | |
| QUANTITY | DOUBLE PRECISION NOT NULL | Stock qty → often mapped to `item_packet` in Redis |
| measurement | VARCHAR(50) | |
| unit | VARCHAR(50) | Unit → `item_packet` (unit label) |
| COST_PRICE_INCLUSIVE | DOUBLE PRECISION NOT NULL | → `cost_price` |
| SALE_PRICE_INCLUSIVE | DOUBLE PRECISION NOT NULL | → `selling_price` (use for price filter) |
| CONDITIONS | VARCHAR(300) DEFAULT 'NA' | |
| SELLER_ISHYIGA_ACCOUNT | VARCHAR(100) | Supplier account → `supplier_account` |
| NIKI_CODE | VARCHAR(30) DEFAULT 'NA' | NIKI code → `item_key_words` |
| FAMILLE | VARCHAR(50) DEFAULT 'NA' | Category/family → `famille` |
| IMAGE_URL | VARCHAR(300) DEFAULT '...' | → `image_url` / `item_image_url` |
| SYNCED_TIME | TIMESTAMP NOT NULL | → `last_sync_time` |
| description | LONGVARBINARY | |
| item_department | VARCHAR(250) DEFAULT 'NA' | Department/category |
| BATCH | VARCHAR(50) | |
| DATE_EXP | VARCHAR(30) DEFAULT '011225' | Expiry |
| taxe_rate, tax_rate | DOUBLE PRECISION | |

**DDL (as provided):**

```sql
CREATE TABLE `chaos_test`.seller_add_stock (
  ID INT NOT NULL,
  ITEM_NAME VARCHAR(200) NOT NULL,
  ITEM_CODE VARCHAR(200) NOT NULL,
  DISCOUNT DOUBLE PRECISION DEFAULT 0,
  QUANTITY DOUBLE PRECISION NOT NULL,
  measurement VARCHAR(50),
  unit VARCHAR(50),
  COST_PRICE_INCLUSIVE DOUBLE PRECISION NOT NULL,
  SALE_PRICE_INCLUSIVE DOUBLE PRECISION NOT NULL,
  CONDITIONS VARCHAR(300) DEFAULT 'NA',
  SELLER_ISHYIGA_ACCOUNT VARCHAR(100),
  NIKI_CODE VARCHAR(30) DEFAULT 'NA',
  FAMILLE VARCHAR(50) DEFAULT 'NA',
  IMAGE_URL VARCHAR(300) DEFAULT 'DEFAULT_IMAGE_URL_TO_BE_PUT',
  SYNCED_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  description LONGVARBINARY(16777215),
  item_department VARCHAR(250) DEFAULT 'NA',
  BATCH VARCHAR(50),
  DATE_EXP VARCHAR(30) DEFAULT '011225',
  taxe_rate DOUBLE PRECISION,
  tax_rate DOUBLE PRECISION
  -- add PRIMARY KEY and any indexes as needed
);
```

**App mapping:** item_commercial_name←ITEM_NAME, item_packet←QUANTITY or unit, selling_price←SALE_PRICE_INCLUSIVE, item_key_words←NIKI_CODE or description, famille←FAMILLE, supplier_account←SELLER_ISHYIGA_ACCOUNT.

---

## 2. niki_items structure (brain where we train items)

**Schema:** `chaos_test.niki_items`

NIKI is the brain where items are trained; use **category_id**, **bus_category_id**, and **item_fabricant** for category/sector/brand filtering.

| Column | Type | Description |
|--------|------|-------------|
| niki_code | VARCHAR(20) NOT NULL | NIKI code → `item_key_words` / item code |
| item_temp_id | INT DEFAULT 1 | |
| item_commercial_name | VARCHAR(200) NOT NULL | Display name |
| item_form | VARCHAR(200) NOT NULL | |
| item_emballage | VARCHAR(200) NOT NULL | |
| item_inn | VARCHAR(200) | |
| **category_id** | VARCHAR(80) | **Category (for category filter)** |
| **bus_category_id** | VARCHAR(45) | **Sector** (BAR, RESTAURANT, SUPERMARKET, BOUTIQUE, PHARMACY, COFFEE-SHOP, LIQUOR STORE) |
| tax_vat, tax_excise, tax_duty | VARCHAR | |
| status | VARCHAR(45) NOT NULL | |
| updated_time | TIMESTAMP NOT NULL | |
| **item_fabricant** | VARCHAR(45) NOT NULL | **Brand** (e.g. Heineken, Leffe) |
| item_packet | DOUBLE PRECISION | |
| item_longeur_mm, item_largeur_mm, item_hauteur_mm, item_poids_gr, item_dosage | DOUBLE PRECISION | |
| shipment_type | CHAR(6) | |
| **item_key_words** | VARCHAR(100) | **Keywords (search)** |
| hs_code, gtin_code, bar_code | VARCHAR(45) | |
| created, global_id, item_dosage_unity, updator, RHIA_CODE, condition_livraison, featured_controls, rating, reviews | various | |
| id_product | INT NOT NULL | |

**DDL (as provided):**

```sql
CREATE TABLE `chaos_test`.niki_items (
  niki_code VARCHAR(20) NOT NULL,
  item_temp_id INT DEFAULT 1,
  item_commercial_name VARCHAR(200) NOT NULL,
  item_form VARCHAR(200) NOT NULL,
  item_emballage VARCHAR(200) NOT NULL,
  item_inn VARCHAR(200),
  category_id VARCHAR(80),
  bus_category_id VARCHAR(45),
  tax_vat VARCHAR(20) NOT NULL,
  tax_excise VARCHAR(45),
  tax_duty VARCHAR(45),
  status VARCHAR(45) NOT NULL,
  updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  item_fabricant VARCHAR(45) NOT NULL,
  item_packet DOUBLE PRECISION,
  item_longeur_mm DOUBLE PRECISION,
  item_largeur_mm DOUBLE PRECISION,
  item_hauteur_mm DOUBLE PRECISION,
  item_poids_gr DOUBLE PRECISION,
  item_dosage DOUBLE PRECISION,
  shipment_type CHAR(6),
  item_key_words VARCHAR(100),
  hs_code VARCHAR(45),
  gtin_code VARCHAR(45),
  bar_code VARCHAR(45),
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  global_id VARCHAR(45),
  item_dosage_unity VARCHAR(45),
  updator VARCHAR(60),
  RHIA_CODE VARCHAR(65),
  condition_livraison VARCHAR(100),
  featured_controls VARCHAR(100) DEFAULT 'NA',
  rating VARCHAR(45),
  reviews VARCHAR(100),
  id_product INT NOT NULL
  -- add PRIMARY KEY (e.g. niki_code or id_product) and indexes as needed
);
```

**Filtering:** Use **category_id** for category (e.g. Beer, Drugs), **bus_category_id** for sector, **item_fabricant** for brand. Price filtering applies to **seller_add_stock.SALE_PRICE_INCLUSIVE** when joining stock to niki (e.g. by NIKI_CODE / niki_code).

**Why the app must use niki_items for brand and category**  
The UI filter (Sector, Category, Brand) should **not** rely only on product name or `seller_add_stock.FAMILLE`. Correct behaviour is:
- **Brand** → from **niki_items.item_fabricant** (e.g. Leffe, Heineken). Otherwise “Category: Beer” + “Brand: Any” would only show items whose name contains “beer” (e.g. “Leffe 300ml Brune Beer”) and hide Corona, Desperados, etc.
- **Category** → from **niki_items.category_id** (or FAMILLE as fallback). So all beers are matched by category, not by the word “beer” in the title.
- **Sector** → from **niki_items.bus_category_id** (e.g. BAR, LIQUOR STORE, PHARMACY).

So the API that feeds the app (shop-with-me, fetchSuggestions) should **join seller_add_stock with niki_items** (on `NIKI_CODE = niki_code`) and include in each product: `item_fabricant`, `category_id`, `bus_category_id`. The app then filters on these when present; until then it falls back to name/category text match (current behaviour).

**Example: Leffe (to see how it fits)**  
- **niki_items:** `item_fabricant = 'Leffe'`, `category_id` e.g. Beer, `bus_category_id` e.g. LIQUOR STORE or BAR.  
- **seller_add_stock:** Rows with `NIKI_CODE` matching the Leffe `niki_code`; `SALE_PRICE_INCLUSIVE` for price filter; `FAMILLE` / `item_department` for category.  
- **App/Redis:** Brand filter "Leffe" → backend filters on `niki_items.item_fabricant = 'Leffe'` (and join to stock); sector "Liquor Store" → `bus_category_id`; search "leffe" → `item_key_words` / `item_commercial_name`.

**What the 2 tables give you for “Leffe” (before Redis / UI)**  
Run these in your DB to see the raw rows; then we wire Redis and the UI from this.

```sql
-- 1) niki_items: the trained “brain” rows for Leffe (by name or brand)
SELECT *
FROM chaos_test.niki_items
WHERE item_commercial_name LIKE '%Leffe%'
   OR item_fabricant = 'Leffe'
   OR item_key_words LIKE '%Leffe%';

-- 2) seller_add_stock: actual stock rows that mention Leffe in the item name
SELECT *
FROM chaos_test.seller_add_stock
WHERE ITEM_NAME LIKE '%Leffe%';
```

- **From niki_items you get:** `niki_code`, `item_commercial_name`, `item_fabricant` (brand), `category_id`, `bus_category_id`, `item_key_words`, etc. — one row per “trained” product variant.  
- **From seller_add_stock you get:** `ID`, `ITEM_NAME`, `ITEM_CODE`, `NIKI_CODE`, `QUANTITY`, `SALE_PRICE_INCLUSIVE`, `SELLER_ISHYIGA_ACCOUNT`, `FAMILLE`, etc. — one row per seller’s stock line.  
Join them on `seller_add_stock.NIKI_CODE = niki_items.niki_code` when you need both catalog (NIKI) and stock (price, qty, seller). Once you see these result sets, we can design the Redis keys and the UI payload from them.

---

## 3. Redis: caching for response time

The app **puts fetched results in Redis** to optimize response time.

- **Where:** `lib/redis-cache.ts` — `buildCacheKey`, `getCached`, `setCached`.
- **Key prefix:** `ihute:api:` (e.g. `ihute:api:fetchSuggestions:globalSearch=beer&sector=bar-resto&...`).
- **Used by:** `app/api/fetchSuggestions/route.ts` — on each request it checks Redis first; on cache miss it calls your backend, then stores the response in Redis.
- **TTL:** Suggestions/search cache TTL is `SUGGESTIONS_TTL_SEC` (default 300 s). Other caches (e.g. shop-with-me) use `DATA_TTL_SEC` (default 120 s).

**Stock in Redis:** Backend can store per-supplier stock under keys like `supplier_<account>` with a JSON value `{ "key": "supplier_<account>", "data": [ ... ] }` (see `lib/supplierStockApi.ts`). Search/fetchSuggestions may read from the same Redis or from DB; your backend decides. After you add category/brand/price filtering, cache keys will include those params so filtered results are cached separately.

---

## 4. Flow summary

1. **Request** → Next.js `fetchSuggestions` proxy (forwards all params, including `category`, `brand`, `priceMin`, `priceMax`).
2. **Cache** → App checks Redis (key from params); if hit, return cached response.
3. **Miss** → App calls your backend (DB / NIKI / Redis); you filter using **stock table** and **niki_items** (category, brand, price).
4. **Response** → App stores result in Redis for next time, then returns to client.

The **stock table** (`seller_add_stock`) and **niki_items** DDL above are the single source of truth for wiring SQL, Redis, and category/brand/price filters (see `docs/backend-category-price-filters.md` and `docs/backend-fetchSuggestions-evaluation-and-optimized-fetch.md`).

**Evaluation and optimized fetch:** For an evaluation of your current Redis/DB flow in **fetchSuggestions** and a proposed **optimized fetch** for shops, items by brand, and search (with category/price), see **`docs/backend-fetchSuggestions-evaluation-and-optimized-fetch.md`**.
