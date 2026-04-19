# `listSuppliersWithProducts` — shop list limit & debugging

## Was only 5 shops showing?

The **Next.js app did not cap** the list. The **Java** `fetchSuggestions` handler often applies a **default `limit` (frequently 5)** when `limit` is omitted.

The Shops tab now calls:

```http
GET /api/fetchSuggestions?listSuppliersWithProducts=pharmacy&Currency=RWF&limit=500
```

If you still see fewer than expected, increase `limit` in `components/category_ai/shops-by-sector.tsx` (`LIST_SUPPLIERS_LIMIT`) or fix the servlet/SQL default.

---

## Queries you can run

### 1) Through the Next.js proxy (same as the browser)

Replace `pharmacy` with your sector id (`bar-resto`, `supermarket`, …):

```http
GET http://localhost:3000/api/fetchSuggestions?listSuppliersWithProducts=pharmacy&Currency=RWF&limit=500&cache=no
```

`cache=no` skips the **Next** Redis wrapper (see `app/api/fetchSuggestions/route.ts`).

### 2) Directly against Java (from `.env`)

```http
GET {JAVA_BACKEND_BASE}/Kaos/fetchSuggestions?listSuppliersWithProducts=pharmacy&Currency=RWF&limit=500
```

Example: `JAVA_BACKEND_BASE=https://ihute.rw/Trading`

---

## SQL (adjust to your real tables)

Table and column names differ per deployment. Typical checks:

**Suppliers / accounts that should appear as pharmacy**

```sql
-- Example pattern: find live suppliers tagged pharmacy + missing nickname (Shop With Me disabled in UI)
SELECT
  ISHYIGA_ACCOUNT,
  OWNER,
  NICKNAME,
  LOCATION,
  DEPARTMENT,
  PREFERRED_CATEGORIES,
  STATUS
FROM your_supplier_or_account_table
WHERE UPPER(COALESCE(STATUS, '')) = 'LIVE'
  AND (
    LOWER(COALESCE(DEPARTMENT, '')) = 'pharmacy'
    OR LOWER(COALESCE(PREFERRED_CATEGORIES, '')) LIKE '%pharmacy%'
  )
ORDER BY OWNER;
```

**Rite specifically** (if you know the account code):

```sql
SELECT ISHYIGA_ACCOUNT, OWNER, NICKNAME, DEPARTMENT, PREFERRED_CATEGORIES, STATUS
FROM your_supplier_or_account_table
WHERE ISHYIGA_ACCOUNT = 'ALG000005204'
   OR LOWER(NICKNAME) = 'rite'
   OR OWNER LIKE '%RITE%PHARMACY%';
```

If Rite is **missing from `listSuppliersWithProducts=pharmacy`**, the servlet’s SQL/join (or Redis snapshot) is excluding that row — fix **Java + data**, not the React list filter.

---

## Shop With Me requires `NICKNAME`

The UI only enables the card link when the API returns a non-empty nickname string. The Shops list reads **many possible JSON keys** (`nickname`, `NICKNAME`, `nickName`, `NickName`, `seller_nickname`, …) and nested objects (`account`, `account_signup`, `profile`, …) because Java serializers differ.

If MySQL `account_signup.nickname` is set but the UI still shows **No nickname**, the **`listSuppliersWithProducts` response is not including that field** (wrong DTO / omitted column). Fix the Java servlet to add `nickname` to each supplier object in that endpoint, or clear the Next.js Redis cache and retest.
