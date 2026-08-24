# Grandma/Umuriro Order Database Persistence Fix

## Summary of Changes

This document describes the fixes applied to ensure that **every successfully submitted Grandma/Umuriro order is saved to the database**.

### Problem
- Grandma orders were showing error: "Order was not saved to the database. Ask admin to set ONBOARDING_MYSQL_* on the server."
- The error was misleading because the system was designed with optional MySQL persistence
- Backend allowed orders to be treated as "successful" even without database confirmation
- Business requirement: **MySQL persistence is MANDATORY, not optional**

### Root Cause
- API endpoint (`/api/onboarding/umuriro`) had fallback "echo only" mode when MySQL wasn't configured
- Frontend was accepting `persisted: false` as a successful state in some code paths
- Database configuration wasn't being enforced at the API layer

### Solution
Three files were modified to enforce mandatory database persistence:

#### 1. Frontend Component: `components/umuriro-boarding.tsx`
**Change:** Restored error check that throws an error if order is not persisted
- **Lines 752-755:** Restored condition `if (json.persisted !== true) throw Error(...)`
- **Impact:** Users cannot see success message unless API confirms `persisted: true`
- **Status:** ✅ Now correctly requires database confirmation

**Before:**
```typescript
// Would show success even with persisted: false
const successMsg = json.persisted 
  ? "Order saved to database"
  : "Received (echo mode)";
```

**After:**
```typescript
// Now throws error if persisted !== true
if (json.persisted !== true) {
  throw Error("Order was not saved to the database...");
}
// Only reaches here if persisted === true
```

#### 2. API Backend: `app/api/onboarding/umuriro/route.ts`
**Changes:** 
- **Lines 83-92 (NEW):** Added mandatory MySQL configuration check
  - Returns 503 error if `ONBOARDING_MYSQL_*` not configured
  - Prevents any order submission without database
- **Impact:** No order can proceed without MySQL configured
- **Status:** ✅ Now rejects requests without database

**Before:**
```typescript
// Would allow non-persisted mode
const persisted = mysqlConfigured;
if (!persisted) {
  // Continue as "echo only" - BAD ❌
}
```

**After:**
```typescript
// Now rejects if not configured
if (!mysqlConfigured) {
  return NextResponse.json({
    ok: false,
    error: "ONBOARDING_MYSQL_* is not configured...",
    persisted: false
  }, { status: 503 })
}
```

- **Lines 165-177 (MODIFIED):** Simplified response to always return `persisted: true` on success
  - Removed conditional `const persisted = mysqlConfigured`
  - Success always means `persisted: true`
  - Error always means `persisted: false`
- **Status:** ✅ Response is now unambiguous

**Before:**
```typescript
const persisted = mysqlConfigured; // Could be false!
return NextResponse.json({
  ok: true,
  persisted, // Might be false! ❌
  message: persisted 
    ? "Saved to database"
    : "Echo mode"
});
```

**After:**
```typescript
// Only reaches here after successful DB insert
return NextResponse.json({
  ok: true,
  persisted: true, // Always true on success ✅
  message: "Order saved to shop_onboarding_draft.",
});
```

#### 3. Environment Documentation: `.env.example`
**Change:** Updated comments to clarify that MySQL is REQUIRED for Grandma orders
- **Lines 72-86:** Added clear requirement statement
- **Impact:** Server administrators know MySQL must be configured
- **Status:** ✅ Documentation updated

**Before:**
```
# Optional: ONBOARDING_MYSQL_* for order persistence
```

**After:**
```
# REQUIRED for Grandma/Umuriro orders — MUST be set
# All Grandma/Umuriro orders MUST be saved to the database
ONBOARDING_MYSQL_HOST=127.0.0.1
ONBOARDING_MYSQL_USER=your_mysql_user
ONBOARDING_MYSQL_PASSWORD=...
ONBOARDING_MYSQL_DATABASE=your_kaos_database
```

### Database Schema
The backend saves orders to `shop_onboarding_draft` table:
```sql
CREATE TABLE IF NOT EXISTS shop_onboarding_draft (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payload_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Schema is created automatically on first insert if user has CREATE TABLE permission.

### Configuration

The server must provide these values in its runtime environment:
```
ONBOARDING_MYSQL_HOST=<mysql-host>
ONBOARDING_MYSQL_PORT=3306
ONBOARDING_MYSQL_USER=<mysql-user>
ONBOARDING_MYSQL_PASSWORD=<mysql-password>
ONBOARDING_MYSQL_DATABASE=<mysql-database>
```

The deployed values are consumed by the server only and must never be committed to this repository.

### How to Verify Database Persistence

#### Option 1: Automated Test (Recommended)
```bash
cd c:\Algo\ project\ihute-frontend
node test-umuriro-database-persistence.mjs
```

This script will:
1. ✅ Verify MySQL credentials are configured
2. ✅ Connect to the database
3. ✅ Create the `shop_onboarding_draft` table if needed
4. ✅ Insert a test order
5. ✅ Query it back to confirm persistence
6. ✅ Report success or failure

#### Option 2: Manual Database Check
After placing a Grandma order, verify it was saved:

```sql
-- Connect to the database configured by ONBOARDING_MYSQL_DATABASE
SELECT * FROM shop_onboarding_draft 
WHERE created_at > NOW() - INTERVAL 1 HOUR 
ORDER BY created_at DESC 
LIMIT 5;
```

Expected output: Your test order with JSON payload containing:
- `kind: "umuriro"`
- `shop.companyName`: Your test shop name
- `rid`: Order reference ID from success message
- `created_at`: Timestamp of insertion

#### Option 3: Manual Flow Test
1. **Load Grandma Page:** Navigate to the Grandma/Umuriro seller onboarding UI
2. **Fill Test Order:**
   - Company name: "TEST SHOP 123"
   - Phone: "+250788123456"
   - Add test items
3. **Submit Order:** Click submit button
4. **Expected Result:** Success message with reference ID (rid)
5. **Verify in Database:**
   ```sql
   SELECT payload_json, created_at 
   FROM shop_onboarding_draft 
   WHERE payload_json->>'$.shop.companyName' = 'TEST SHOP 123';
   ```

### Error Messages - What They Mean

#### ❌ "ONBOARDING_MYSQL_* is not configured on the server"
- **Cause:** Database credentials not set in `.env`
- **Solution:** Set these environment variables:
  - `ONBOARDING_MYSQL_HOST` (server IP or hostname)
  - `ONBOARDING_MYSQL_USER` (MySQL username)
  - `ONBOARDING_MYSQL_PASSWORD` (MySQL password)
  - `ONBOARDING_MYSQL_DATABASE` (target database name)
  - `ONBOARDING_MYSQL_PORT` (optional, defaults 3306)
- **HTTP Status:** 503 Service Unavailable

#### ❌ "Failed to connect to database"
- **Cause:** MySQL server not running or unreachable
- **Solution:** 
  - Verify MySQL is running using the host and user from the server environment
  - Check host/port are correct
  - Check firewall rules allow connection
- **HTTP Status:** 503 Service Unavailable

#### ❌ "Access denied for configured user"
- **Cause:** Wrong password or user permissions insufficient
- **Solution:**
  - Verify credentials in `.env.local`
  - Ensure user has INSERT and CREATE TABLE permissions on the database
- **HTTP Status:** 503 Service Unavailable

#### ✅ "Order saved to shop_onboarding_draft"
- **Status:** Order successfully persisted to database
- **Verified:** You can query the database and find the order
- **HTTP Status:** 200 OK

### Code Flow - Before and After

#### Before (Broken ❌)
```
User submits order
    ↓
Frontend: POST /api/onboarding/umuriro
    ↓
API: Check if MySQL configured
    ├─ If YES: Insert to database ✅
    └─ If NO: Skip database, send "echo" mode response ❌❌❌
    ↓
Frontend: Check json.persisted
    ├─ If true: Show success ✅
    └─ If false: Show error but might continue anyway ⚠️
```

**Problem:** Non-persisted orders could appear successful; business loses data

#### After (Fixed ✅)
```
User submits order
    ↓
Frontend: POST /api/onboarding/umuriro
    ↓
API: Check if MySQL configured
    ├─ If NO: Return 503 error ❌
    └─ If YES: Try to insert to database
        ├─ If success: Return persisted: true ✅
        └─ If error: Return 503 error ❌
    ↓
Frontend: Check json.persisted
    ├─ If true: Show success message ✅
    └─ If false: Show error to user ❌
        (Cannot proceed without persistence)
```

**Guarantee:** Every successful order is in the database

### Files Modified

| File | Lines | Change | Purpose |
|------|-------|--------|---------|
| `components/umuriro-boarding.tsx` | 752-755, 760-776 | Restored error check; removed fallback success | Frontend enforcement |
| `app/api/onboarding/umuriro/route.ts` | 83-92 | Added MySQL config validation | Backend enforcement |
| `app/api/onboarding/umuriro/route.ts` | 165-177 | Simplified response; removed conditional | Response clarity |
| `.env.example` | 72-86 | Updated documentation | Admin guidance |

### Database Table

**Name:** `shop_onboarding_draft`  
**Database:** `ONBOARDING_MYSQL_DATABASE` (from server configuration)  
**Auto-created:** Yes (on first insert if permissions allow)

**Columns:**
- `id`: BIGINT AUTO_INCREMENT (order record ID)
- `payload_json`: JSON (full order payload with rid, shop details, items)
- `created_at`: TIMESTAMP (when order was submitted)

**Query Recent Orders:**
```sql
SELECT 
  id,
  JSON_EXTRACT(payload_json, '$.rid') as reference_id,
  JSON_EXTRACT(payload_json, '$.shop.companyName') as shop_name,
  JSON_EXTRACT(payload_json, '$.line.totalRwf') as total_amount,
  created_at
FROM shop_onboarding_draft
WHERE JSON_EXTRACT(payload_json, '$.kind') = 'umuriro'
ORDER BY created_at DESC
LIMIT 20;
```

### Business Requirement Met

✅ **Every successfully submitted Grandma/Umuriro order is saved to the database**
- System cannot return success without database confirmation
- MySQL configuration is mandatory, not optional
- No silent fallback to "echo mode"
- Admin must configure MySQL before Grandma orders can be processed

### Next Steps

1. **Run the automated test** (recommended):
   ```bash
   node test-umuriro-database-persistence.mjs
   ```

2. **Place a test order** through the UI and verify it appears in the database

3. **Monitor production** for any Grandma orders being placed and verify they all appear in `shop_onboarding_draft`

4. **Check for lingering issues** with the query in "Database Table" section above

### Rollback (if needed)

If you need to revert these changes:
1. `git checkout components/umuriro-boarding.tsx`
2. `git checkout app/api/onboarding/umuriro/route.ts`
3. `git checkout .env.example`

---

**Last Updated:** Today  
**Status:** ✅ Implementation Complete  
**Testing:** Pending database verification  
**Business Requirement:** ENFORCED - All Grandma orders must persist to database
