# Global Search Fixes - Verification Guide

**Purpose:** Step-by-step guide to verify that all Global Search fixes work correctly  
**Estimated Time:** 15-20 minutes  
**Environment:** Test on a staging/development instance with real search data

---

## Test Setup

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Search box visible in header
4. Have access to test data (or use production-like data)

---

## Test Suite

### ✅ TEST 1: Search by Product Name (Basic)
**Purpose:** Verify product name matches work and aren't over-filtered  
**Steps:**
1. In search box, type: `sugar`
2. Look at dropdown - should show multiple products with "sugar" in name
3. Click "Search" to see full results
4. Verify: Get 5+ results (not filtered out as "not relevant")

**Expected Behavior:**
- Dropdown shows 5-10 items starting with "Sugar"
- Full page shows 20+ results with "sugar" anywhere in name/keywords
- Browser console shows: `[ProductFilter] Kept XX/YY products with score >= 15`

**✗ FAIL:** Dropdown empty or only 1-2 items  
**✓ PASS:** Dropdown shows 5+ items, full page shows 20+

---

### ✅ TEST 2: Search by Item Code (Critical)
**Purpose:** Verify item code matches aren't filtered by strict threshold  
**Steps:**
1. Find a product code in your database (e.g., "500ml", "1L", "COFFEE-001")
2. In search box, type the code: `500ml`
3. Observe dropdown and full results

**Expected Behavior:**
- Dropdown shows products with "500ml" in code/description
- Full page shows many "500ml" variants (not filtered out)
- Browser console shows: `[ProductFilter] Code match found, score +3-5`

**✗ FAIL:** No results or very few results  
**✓ PASS:** Dropdown shows 5+, full page shows 20+

---

### ✅ TEST 3: Search by Brand (New Field Coverage)
**Purpose:** Verify brand search works with enhanced field coverage  
**Steps:**
1. Find a brand name (e.g., "NESCAFÉ", "Coca-Cola", "PepsiCo")
2. In search box, type brand: `NESCAFÉ`
3. Observe results

**Expected Behavior:**
- Dropdown shows products from that brand
- Full page shows all brand items (not all filtered out)
- Browser console shows: `[ProductFilter] Brand match +4` in scoring

**✗ FAIL:** No results or completely empty  
**✓ PASS:** Dropdown 5+, full page 10+

---

### ✅ TEST 4: Search by Category/Famille (New Field Coverage)
**Purpose:** Verify category/department search works  
**Steps:**
1. Find a category (e.g., "Beverages", "Dairy", "Fruits")
2. In search box, type: `Beverages`
3. Observe results

**Expected Behavior:**
- Dropdown shows items in that category
- Full page shows many items (not overly filtered)
- Browser console shows: `[ProductFilter] Famille match +3`

**✗ FAIL:** No results or error  
**✓ PASS:** Dropdown 5+, full page 20+

---

### ✅ TEST 5: Search by Supplier Name
**Purpose:** Verify supplier filtering works with lowered threshold  
**Steps:**
1. Find a supplier name (e.g., "Shop ABC", "Supplier XYZ")
2. In search box, type supplier: `Shop ABC`
3. Observe results

**Expected Behavior:**
- Dropdown shows "Shop ABC" as a suggestion
- Full page shows that supplier + their products
- Browser console shows: `[SupplierFilter] Kept X/Y suppliers with score >= 3`

**✗ FAIL:** Supplier not shown in dropdown  
**✓ PASS:** Supplier appears in dropdown and full page

---

### ✅ TEST 6: Multi-Word AND Search
**Purpose:** Verify AND logic works (both words must match)  
**Steps:**
1. Type multi-word query: `coffee 500ml`
2. Observe results

**Expected Behavior:**
- Results contain BOTH "coffee" AND "500ml" (not just one)
- Dropdown shows 3-5 matching items
- Full page shows 5-10 matching items
- Browser console shows: `[ProductFilter] ... AND=true` in logs

**✗ FAIL:** Results show items with only "coffee" or only "500ml"  
**✓ PASS:** All results have both words

---

### ✅ TEST 7: Partial/Prefix Matching
**Purpose:** Verify substring matching works  
**Steps:**
1. Type partial word: `cof` (not "coffee")
2. Observe results

**Expected Behavior:**
- Dropdown shows coffee products (prefix match works)
- Browser console shows: `[ProductFilter] Starts with match +50` or `Word boundary match +25`

**✗ FAIL:** No results for prefix search  
**✓ PASS:** Shows items starting with "cof"

---

### ✅ TEST 8: Case Insensitivity
**Purpose:** Verify search is case-insensitive  
**Steps:**
1. Search: `COFFEE` (all caps)
2. Note results
3. Then search: `coffee` (all lowercase)
4. Compare results - should be identical

**Expected Behavior:**
- Both searches return identical results
- No differences in count or order
- Verification: Check browser console logs use `.toLowerCase()`

**✗ FAIL:** Different results for different cases  
**✓ PASS:** Identical results regardless of case

---

### ✅ TEST 9: No Duplicate Products
**Purpose:** Verify deduplication works  
**Steps:**
1. Do a broad search (e.g., `sugar`)
2. Scan full page results for duplicate products
3. Look for same product appearing twice with same code/supplier/price

**Expected Behavior:**
- No duplicate products in results
- Each product appears once with highest stock count
- Browser console shows: `[Dedupe] Removed X duplicates`

**✗ FAIL:** Same product appears twice in results  
**✓ PASS:** Each product unique, highest stock preserved

---

### ✅ TEST 10: Dropdown Instant Feedback
**Purpose:** Verify dropdown shows quick results without delay  
**Steps:**
1. Type in search box: `s`
2. Watch dropdown load (should be instant)
3. Continue typing: `sh` → `sho` → `shop`
4. Each keystroke updates dropdown instantly

**Expected Behavior:**
- Dropdown appears after first character (or 2 chars)
- Shows 8-10 items instantly
- Updates on each keystroke (debounced ~300ms)
- No "Loading..." spinner if cache hit

**✗ FAIL:** Long delay (>1s) or empty dropdown  
**✓ PASS:** Instant feedback, smooth typing experience

---

### ✅ TEST 11: Full Page Pagination
**Purpose:** Verify full page pagination shows all results  
**Steps:**
1. Do a broad search: `salt`
2. Full page loads - note first page count
3. Scroll down to pagination controls
4. Click "Next" page
5. Verify new items load (not repeating previous page)

**Expected Behavior:**
- First page shows distinct items
- Second page shows different items (not duplicates)
- Pagination navigation works
- Total result count is reasonable

**✗ FAIL:** Pagination broken or shows duplicates across pages  
**✓ PASS:** Clean pagination, no duplicates

---

### ✅ TEST 12: Browser Console Logging
**Purpose:** Verify debugging logs are working  
**Steps:**
1. Open browser DevTools → Console tab
2. Do a search: `coffee`
3. Look for logs starting with `[ProductFilter]`, `[SupplierFilter]`, `[Dedupe]`

**Expected Output Example:**
```
[ProductFilter] Filtering 500/500 products, 1 term(s), AND=false, query: "coffee", minScore=15
[ProductFilter] Kept 180/500 products with score >= 15
[ProductFilter] Top 3 scores: [{name: "COFFEE-1L", code: "COF-001", score: 95}, ...]

[SupplierFilter] Filtering 50 suppliers with 1 terms for query: "coffee"
[SupplierFilter] Kept 12/50 suppliers with score >= 3
[SupplierFilter] Top 3 scores: [{name: "Coffee Shop A", score: 85}, ...]

[Dedupe] Input: 180 products | Codes: 150 unique | No-code: 30
[Dedupe] Removed 20 duplicates | Output: 160 products
```

**✗ FAIL:** No logs or logs show 0 matches  
**✓ PASS:** Detailed logs showing filtering and dedup steps

---

## Score Calibration

If you see unexpected filtering behavior, check the scores in console:

**Product Relevance Scoring:**
- Exact match name: 100 points
- Starts with keyword: 50 points
- Word boundary match: 25 points
- Contains keyword: 20 points
- Brand match: 4 points
- Category match: 3 points
- Description match: 2 points
- Item code match: 3-5 points

**Current Thresholds (NOT filters entirely, just scores below these):**
- Dropdown products: 5 (very inclusive)
- Full page products: 15 (moderate)
- Dropdown suppliers: 3 (very inclusive)
- Full page suppliers: 5 (inclusive)

If products are still being filtered out unexpectedly:
1. Check console logs for actual scores
2. Compare against thresholds above
3. If score < threshold and should pass → Lower threshold by 5 points
4. If many low scores → Check if search blob includes all needed fields

---

## Troubleshooting

| Symptom | Root Cause | Solution |
|---------|-----------|----------|
| Dropdown empty | Backend returned 0 results OR frontend filtered all | Check console logs for raw vs filtered counts |
| Very few results | Threshold too high OR not searching all fields | Lower minScore by 5 or check field coverage |
| Duplicates in results | Dedup not working for unbranded items | Check console for `[Dedupe]` logs |
| Partial match not working | Word boundary regex too strict | Check if `/^\d+/` regex for codes working |
| Case-sensitive results | Database collation issue OR toLowerCase() not applied | Verify console shows `.toLowerCase()` in blob |
| Slow dropdown | Network timeout (90s) or large dataset | Check if cache hit (`cacheHit=true` in response) |

---

## Performance Metrics

Target performance:
- Dropdown load: <100ms (cached) or <500ms (first load)
- Full page load: <1s
- Result count stability: ±10% variance between runs

---

## Sign-Off Checklist

- [ ] All 12 tests passed
- [ ] Console logs show expected filtering behavior
- [ ] No duplicates in any results
- [ ] Partial/prefix matching works
- [ ] Case insensitivity confirmed
- [ ] Multi-word AND search works
- [ ] Dropdown provides instant feedback
- [ ] Pagination doesn't repeat results
- [ ] Performance acceptable (<500ms dropdown, <1s full page)
- [ ] Browser console clean (no errors, only expected logs)

**If all boxes ✓:** Global Search fixes verified and working correctly  
**If any box ✗:** Note the failed test and check troubleshooting table

---

## Debugging Commands

Paste in browser console to debug:

```javascript
// See all recent product scores
console.log(document.querySelectorAll('[data-score]'))

// Check cache settings
sessionStorage.getItem('ihute:api:fetchSuggestions:*')

// Monitor next search
window.debugSearch = true  // Enables verbose logging

// Check search performance
performance.mark('search-start')
// ... do search ...
performance.mark('search-end')
performance.measure('search-time', 'search-start', 'search-end')
console.log(performance.getEntriesByName('search-time')[0].duration)
```

---

**Last Updated:** 2025-01-XX  
**Status:** Ready for user testing
