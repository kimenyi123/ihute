# Global Search Debug Analysis - Complete Findings

## Executive Summary
The Global Search feature has multiple issues causing incomplete and incorrect results. Issues span frontend filtering, backend field coverage, response handling, and deduplication logic.

---

## Root Cause Analysis

### Issue 1: Frontend Relevance Score Filtering Too Aggressive

**Location:** `lib/search-utils.ts`, `filterProductsByRelevance()` (line 200)

**Problem:**
```typescript
const minScore = 25 // Default minimum for strict filtering
const effectiveMinScore = andTokens.length > 1 ? 0 : minScore
```

**Impact:**
- Products with relevance scores < 25 are filtered out
- Valid matches in keywords/tags are lost
- Multi-word searches (AND tokens) bypass this check but single-word searches don't
- Inconsistent behavior

**Root Cause:**
- Scoring algorithm may not give high enough scores to valid matches
- E.g., a product matching on item_code might get score 3, but minimum is 25
- Supplier filters use even lower threshold (minScore = 5), showing inconsistent logic

**Example:**
- Search: "N-22" (item code)
- Product has `item_code = "N-22"` but `item_commercial_name = "Nescafé"`
- Code match score ≈ 3-5 (from `codeScore += 3`)
- Product filtered out because 3 < 25

---

### Issue 2: Inconsistent Response Structure Handling

**Location:** `app/search/page.tsx`, `normalizeSupplierProductsResponse()` (line 400+)

**Problem:**
Backend can return results in multiple formats:
1. Array of objects with nested `.items`
2. Array of flat objects
3. Object with `.data` array (Redis format: `{ key, data: [...] }`)
4. Object with `.sellers` array
5. Object with `.products` array

**Impact:**
- Response mapping may fail silently
- Some response formats not properly normalized
- Products missing supplier information or prices

**Example:**
```javascript
// Format 1: Redis { key: "supplier_ABC", data: [...] }
// Format 2: { products: [...] }
// Format 3: { sellers: [{ products: [...] }] }
// All need different normalization paths
```

---

### Issue 3: Missing Backend Field Coverage

**Location:** Backend Java service (not in this codebase, but integration point)

**Problem:**
Backend may not search ALL relevant fields. From `docs/backend-fetchSuggestions-evaluation-and-optimized-fetch.md`:

Fields that SHOULD be searched but may be missing:
- ✅ `item_commercial_name` (confirmed)
- ✅ `item_key_words` (confirmed)
- ❓ `item_code` (ITEM_CODE)
- ❓ `supplier_name` / `SELLER_NAMES`
- ❓ `item_fabricant` / `brand` (from niki_items.item_fabricant)
- ❓ `FAMILLE` / category
- ❓ `item_department`
- ❓ `description` (from seller_add_stock.description - LONGVARBINARY)
- ❓ `bar_code` (from niki_items.bar_code)
- ❓ `item_form` (from niki_items.item_form)

**Impact:**
- Searches by brand/category/code return incomplete results
- Translated keywords (Kinyarwanda/French) not searched
- Barcode searches don't work

---

### Issue 4: Frontend Doesn't Trust Backend Search

**Location:** `app/search/page.tsx`, line 750+

**Problem:**
Frontend applies ADDITIONAL filtering after backend search:
```typescript
// ✅ FIX: Trust backend - it already handles translation!
// No client-side filtering for products since backend does the work
const filteredProducts = data.products || []

// Keep light filtering for suppliers (optional - can be removed if backend handles it)
const filteredSuppliersByName = filterSuppliersByRelevance(
  data.suppliersByName || [],
  debouncedQ,
  10 // Lower threshold for suppliers
)
```

But then in search page supplier product display (line 930+):
```typescript
const displayedSupplierProducts = useMemo(() => {
  let raw: Product[]
  if (!query) {
    raw = shopProducts
  } else if (Array.isArray(supplierSearchResults) && supplierSearchResults.length > 0) {
    raw = supplierSearchResults
  } else if (shopProducts.length > 0) {
    // Backend returned 0; filter loaded catalog client-side
    const q = query.toLowerCase()
    raw = shopProducts.filter((p) => {
      const name = (p.item_commercial_name ?? "").toLowerCase()
      const kw = (p.item_key_words ?? "").toLowerCase()
      const kr = ((p as any).item_key_words_kinyarwanda ?? "").toLowerCase()
      const fr = ((p as any).item_key_words_french ?? "").toLowerCase()
      const desc = ((p as any).description ?? "").toLowerCase()
      return [name, kw, kr, fr, desc].some((s) => s.includes(q))
    })
  }
})
```

**Impact:**
- When backend returns 0 results, frontend does fallback client-side filtering
- But this only works if ALL product data is already loaded (from `shopProducts`)
- Kinyarwanda/French keywords in response will be filtered by frontend

---

### Issue 5: Deduplication May Remove Valid Results

**Location:** `lib/dedupe-search-products.ts`, `dedupeSearchProductsByItemCodeAndSellingPrice()`

**Problem:**
```typescript
// Collapse duplicates: same supplier + item code + selling price = one card
export function dedupeSearchProductsByItemCodeAndSellingPrice(products: unknown[]): unknown[] {
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const p of rows) {
    if (!searchProductItemCode(p)) continue  // ⚠️ Skips products without item_code!
    const k = dedupeKey(p)
    const g = groups.get(k)
    if (g) g.push(p)
    else groups.set(k, [p])
  }
  // Merge groups...
}
```

**Impact:**
- Products without `item_code` are left in place but not deduplicated
- Products with same code but different prices create multiple cards
- Inconsistent deduplication behavior

**Example:**
- Product A: `item_code="COFFEE-1", price=3000` → kept
- Product B: `item_code="COFFEE-1", price=3000` (from different supplier) → merged into single card
- Product C: `item_code=null, price=3000` → left out of dedup, remains as-is

---

### Issue 6: Filtering After Pagination

**Location:** `app/search/page.tsx`, supplier products pagination (line 950+)

**Problem:**
Frontend receives products from backend, but pagination is client-side:
```typescript
const [supplierProductPage, setSupplierProductPage] = useState(1)
const [supplierProductsPerPage, setSupplierProductsPerPage] = useState(15)

// Pagination happens AFTER filtering and sorting
const start = (supplierProductPage - 1) * supplierProductsPerPage
const paginatedResults = displayedSupplierProducts.slice(start, start + supplierProductsPerPage)
```

**Impact:**
- Frontend fetches full supplier catalog (up to 10,000 items)
- Filters applied to ALL items before pagination
- If user searches "beer" and gets 100 results, but API returns 10,000, filtering slow
- Backend doesn't apply search filter to supplier_products query

---

### Issue 7: Missing Field Preservation in Response

**Location:** Various API response handling

**Problem:**
Not all searchable fields are included in API response:
- `item_fabricant` (brand) not always included
- `category_id` / `bus_category_id` not included
- `item_description` sometimes missing
- Multilingual keywords (Kinyarwanda/French) not included

**Impact:**
- Client can't filter by brand/category (requires backend support)
- Frontend fallback filtering for supplier products doesn't work if fields missing

---

### Issue 8: Case Sensitivity Issues

**Location:** Frontend search-utils.ts (case-insensitive) vs Backend (unknown)

**Problem:**
- Frontend filtering is case-insensitive: `query.toLowerCase()`
- Backend SQL may not be case-insensitive (depends on database collation)
- Inconsistent search behavior

---

### Issue 9: Partial Keyword Matching Logic

**Location:** `lib/search-utils.ts`, `productMatchesAllSearchTokens()`

**Problem:**
```typescript
export function tokenMatchesInSearchBlob(token: string, blob: string): boolean {
  const t = token.toLowerCase()
  if (!t || !blob) return false
  if (/^\d+$/.test(t)) {
    const re = new RegExp(`(?<!\\d)${escapeRegex(t)}(?!\\d)`, "i")
    return re.test(blob)
  }
  return blob.includes(t)  // Simple substring match
}
```

**Impact:**
- Numeric tokens (e.g., "500" in "500ml") use word boundaries ✓
- Text tokens use simple substring match (no word boundary) ✗
- E.g., "in" matches "wine", "ink", "Leffe" (false positives)

---

### Issue 10: Backend Does Not Cache Global Search

**Location:** `docs/backend-fetchSuggestions-evaluation-and-optimized-fetch.md`, Issue 4

**Problem:**
From docs: "Global search (no supplier/brand/sector) always hits DB"

**Impact:**
- High database load for repeated searches
- No Redis cache for global search (unlike supplier/brand/sector queries)
- Slow response times under load

---

## Summary Table

| Issue | Location | Severity | Type | Fix Complexity |
|-------|----------|----------|------|-----------------|
| Frontend minScore too high | search-utils.ts | HIGH | Logic | Low |
| Response structure handling | search-utils.ts, page.tsx | MEDIUM | Integration | Medium |
| Backend field coverage | Backend Java | HIGH | Backend | Medium |
| Frontend doesn't trust backend | page.tsx | MEDIUM | Logic | Low |
| Dedup may skip products | dedupe-search-products.ts | MEDIUM | Logic | Low |
| Pagination after filtering | page.tsx | MEDIUM | Logic | Low |
| Missing field preservation | API responses | MEDIUM | Integration | Low |
| Case sensitivity mismatch | Both frontend/backend | LOW | Config | Low |
| Partial match logic | search-utils.ts | LOW | Logic | Low |
| No global search cache | Backend | MEDIUM | Backend | Medium |

---

## Recommended Fixes (Frontend Only)

Since we can't modify the backend Java code directly in this workspace, focus on:

1. **Lower minScore threshold** for products (20 → 10) and suppliers (10 → 5)
2. **Remove redundant frontend filtering** when backend already returned results
3. **Improve response structure handling** to support all formats
4. **Better case-insensitive matching** across all platforms
5. **Improve deduplication** to not skip products without item_code
6. **Add debugging logs** to identify which products are filtered out

---

## Testing Checklist

- [ ] Search by product name returns all matches
- [ ] Search by item code returns exact product
- [ ] Search by brand/category returns all products in that category
- [ ] Search by supplier name returns supplier + their products
- [ ] Multi-word search (AND logic) works correctly
- [ ] Partial keyword matching works (e.g., "coffee" finds "COFFEE-1")
- [ ] Case-insensitive matching works across all searches
- [ ] No duplicate products in results
- [ ] Pagination shows correct results
- [ ] Response works for all backend formats
