# Backend: Category, Brand & Price Filtering (Guide)

The search page sends **category**, **brand**, **priceMin**, and **priceMax** in the URL. Today the app applies these **client-side** because the backend does not yet filter by them. This doc is a guide for adding server-side filtering so the backend returns only matching products.

**Tables and NIKI:** For the **stock table** and **niki_items** structure (the brain where we train items), see **`docs/backend-stock-and-niki-structure.md`**. That doc also describes how the app caches results in Redis to optimize response time.

---

## 1. Query params the frontend sends

When the user applies filters and clicks "Show products", the app calls:

- **Next.js proxy:** `GET /api/fetchSuggestions?...`
- **Backend (your service):** receives the same query string forwarded by the proxy.

| Param        | Example   | Description                          |
|-------------|-----------|--------------------------------------|
| `globalSearch` | `beer`    | Full-text search query (existing).   |
| `sector`    | `bar-resto` | Sector filter (existing).             |
| **`category`** | `beer`    | Product category slug (e.g. Beer, Drugs, Wines, BBQ). |
| **`brand`** | `heineken` | Brand slug (e.g. Heineken, Primus).   |
| **`priceMin`** | `2400`  | Minimum price (RWF).                  |
| **`priceMax`** | `11800`  | Maximum price (RWF).                  |
| `district`, `cell` | …     | Location (existing).                 |

The proxy in `app/api/fetchSuggestions/route.ts` **forwards all query params** to your backend. So once the backend reads `category`, `brand`, `priceMin`, `priceMax`, it can filter and the frontend will automatically use server-filtered results (and can eventually drop client-side filtering for those params).

---

## 2. Example SQL for category filter

Assume products are in a table with a category-like column (e.g. `famille`, `category`, or `item_department`). Normalize to a slug or code for the URL (e.g. `beer`, `drugs`, `wines`).

**Option A – by category name/slug:**

```sql
-- category param e.g. 'beer', 'drugs', 'wines'
SELECT *
FROM products   -- or your items table
WHERE 1=1
  AND (globalSearch is empty OR item_commercial_name LIKE CONCAT('%', :globalSearch, '%')
       OR item_key_words LIKE CONCAT('%', :globalSearch, '%'))
  AND ( :category = '' OR LOWER(TRIM(famille)) = LOWER(:category)
        OR LOWER(TRIM(category)) = LOWER(:category)
        OR LOWER(TRIM(item_department)) = LOWER(:category)
        OR LOWER(TRIM(famille)) LIKE CONCAT('%', :category, '%') );
```

**Option B – category mapping table (slug → backend value):**

```sql
-- categories: id, slug (e.g. 'beer'), name (e.g. 'Beer')
SELECT p.*
FROM products p
LEFT JOIN categories c ON LOWER(TRIM(p.famille)) = LOWER(TRIM(c.name))
  OR LOWER(TRIM(p.category)) = LOWER(TRIM(c.name))
WHERE ( :category = '' OR c.slug = :category );
```

**Option C – single column with slug (e.g. `category_slug`):**

```sql
WHERE ( :category = '' OR category_slug = :category )
```

Use the same pattern for **sector** if you store it (e.g. `sector = :sector`).

---

## 3. Example SQL for brand filter

If brand is on the product or in a related table:

**Option A – brand on product:**

```sql
-- brand param e.g. 'heineken', 'primus'
WHERE ( :brand = '' OR LOWER(TRIM(brand)) = LOWER(:brand)
        OR LOWER(TRIM(brand_name)) LIKE CONCAT('%', :brand, '%') );
```

**Option B – brands table + join:**

```sql
-- brands: id, slug, name
SELECT p.*
FROM products p
LEFT JOIN brands b ON LOWER(TRIM(p.brand_id)) = b.id OR LOWER(TRIM(p.brand_name)) = LOWER(TRIM(b.name))
WHERE ( :brand = '' OR b.slug = :brand );
```

---

## 4. Example SQL for price range

Use numeric columns for price (e.g. `selling_price`, `price`, `SALE_PRICE_INCLUSIVE`). Normalize to one value per row (e.g. prefer `selling_price` in RWF).

```sql
WHERE 1=1
  AND ( :priceMin = '' OR COALESCE(selling_price, price, 0) >= CAST(:priceMin AS DECIMAL(18,2)) )
  AND ( :priceMax = '' OR COALESCE(selling_price, price, 0) <= CAST(:priceMax AS DECIMAL(18,2)) );
```

If price is stored as string or with currency, parse/normalize in the backend before comparing.

---

## 5. Combined example (category + brand + price)

```sql
SELECT *
FROM products p
LEFT JOIN categories c ON LOWER(TRIM(p.famille)) = LOWER(TRIM(c.name))   -- if you use category table
LEFT JOIN brands b ON p.brand_id = b.id                                   -- if you use brand table
WHERE 1=1
  -- existing: globalSearch, sector
  AND ( :category = '' OR c.slug = :category OR LOWER(TRIM(p.famille)) LIKE CONCAT('%', :category, '%') )
  AND ( :brand = '' OR b.slug = :brand OR LOWER(TRIM(p.brand_name)) LIKE CONCAT('%', :brand, '%') )
  AND ( :priceMin = '' OR COALESCE(p.selling_price, p.price, 0) >= CAST(:priceMin AS DECIMAL(18,2)) )
  AND ( :priceMax = '' OR COALESCE(p.selling_price, p.price, 0) <= CAST(:priceMax AS DECIMAL(18,2)) );
```

Adjust table/column names to your schema.

---

## 6. Where the backend is called

- **Next.js:** `app/api/fetchSuggestions/route.ts` forwards **all** query params to your backend URL (from `getFetchSuggestionsUrl()`).
- **Frontend:** Builds URLs like  
  `/api/fetchSuggestions?globalSearch=...&sector=bar-resto&category=beer&brand=heineken&priceMin=2400&priceMax=11800&Currency=RWF`

So you only need to:

1. In your backend, read `category`, `brand`, `priceMin`, `priceMax` from the request.
2. Add the corresponding SQL (or Redis/query logic) as above.
3. Return the same JSON shape (e.g. `products[]`, `suppliersByName`, `suppliersByProduct`) so the frontend keeps working.

Once the backend filters by category, brand, and price, you can remove or relax the client-side filtering in `app/search/page.tsx` (see `productMatchesCategoryAndPrice` and the useMemo that filter `searchResult.products` and `sectorSellers`).
