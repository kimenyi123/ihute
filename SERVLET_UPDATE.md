# Java Servlet Update Required

## Issue
The frontend is now prioritizing `BUYER_OWNER` over `BUYER_NAME`, but the servlet queries need to be updated to include `BUYER_OWNER` in the SELECT statements.

## Required Changes in OrdersServlet.java

### 1. Update `listSellerOrders` method

**Current:**
```java
String sql =
"SELECT ID_ORDER, SELLER_ISHYIGA_ACCOUNT, SELLER_NAMES, BUYER_ISHYIGA_ACCOUNT, " +
"BUYER_OWNER, BUYER_NAMES, BUYER_PHONE, BUYER_EMAIL, " +
"DELIVERY_LOCATION, PAYMENT_NAME, PAYMENT_ID, ORDER_STATUS, REKISIYO_STATUS, REFERENCE, " +
"AMOUNT, CURRENCY, heure AS CREATED_AT " +
"FROM order_transaction " +
"WHERE SELLER_ISHYIGA_ACCOUNT = ? " +
"ORDER BY ID_ORDER DESC";
```

**Verified:** ✅ Already includes `BUYER_OWNER`

### 2. Update `listBuyerOrders` method

**Current:**
```java
String sql =
"SELECT ID_ORDER, SELLER_ISHYIGA_ACCOUNT, SELLER_NAMES, BUYER_OWNER, BUYER_PHONE, " +
"DELIVERY_LOCATION, PAYMENT_NAME, PAYMENT_ID, ORDER_STATUS, REKISIYO_STATUS, REFERENCE, " +
"AMOUNT, CURRENCY, heure AS CREATED_AT " +
"FROM order_transaction " +
"WHERE SELLER_ISHYIGA_ACCOUNT = ? " +
"ORDER BY ID_ORDER DESC";
```

**Issue:** Missing `BUYER_EMAIL`, `BUYER_NAMES`, `BUYER_ISHYIGA_ACCOUNT`

**Fixed:**
```java
String sql =
"SELECT ID_ORDER, SELLER_ISHYIGA_ACCOUNT, SELLER_NAMES, " +
"BUYER_ISHYIGA_ACCOUNT, BUYER_OWNER, BUYER_NAMES, BUYER_PHONE, BUYER_EMAIL, " +
"DELIVERY_LOCATION, PAYMENT_NAME, PAYMENT_ID, ORDER_STATUS, REKISIYO_STATUS, REFERENCE, " +
"AMOUNT, CURRENCY, heure AS CREATED_AT " +
"FROM order_transaction " +
"WHERE BUYER_ISHYIGA_ACCOUNT = ? " +
"ORDER BY ID_ORDER DESC";
```

And update the result mapping:
```java
while (rs.next()) {
    JSONObject o = new JSONObject();
    o.put("ID_ORDER", rs.getInt("ID_ORDER"));
    o.put("SELLER_ISHYIGA_ACCOUNT", nz(rs.getString("SELLER_ISHYIGA_ACCOUNT")));
    o.put("SELLER_NAMES", nz(rs.getString("SELLER_NAMES")));
    o.put("BUYER_ISHYIGA_ACCOUNT", nz(rs.getString("BUYER_ISHYIGA_ACCOUNT")));
    o.put("BUYER_OWNER", nz(rs.getString("BUYER_OWNER")));      // ✅ Important
    o.put("BUYER_NAMES", nz(rs.getString("BUYER_NAMES")));
    o.put("BUYER_PHONE", nz(rs.getString("BUYER_PHONE")));
    o.put("BUYER_EMAIL", nz(rs.getString("BUYER_EMAIL")));      // ✅ For guest detection
    o.put("DELIVERY_LOCATION", nz(rs.getString("DELIVERY_LOCATION")));
    o.put("PAYMENT_NAME", nz(rs.getString("PAYMENT_NAME")));
    o.put("PAYMENT_ID", nz(rs.getString("PAYMENT_ID")));
    o.put("ORDER_STATUS", nz(rs.getString("ORDER_STATUS")));
    o.put("REKISIYO_STATUS", nz(rs.getString("REKISIYO_STATUS")));
    o.put("REFERENCE", nz(rs.getString("REFERENCE")));
    o.put("AMOUNT", rs.getDouble("AMOUNT"));
    o.put("CURRENCY", nz(rs.getString("CURRENCY")));
    Timestamp ts = rs.getTimestamp("CREATED_AT");
    if (ts != null) o.put("CREATED_AT", ts.getTime());
    arr.put(o);
}
```

### 3. Update `buyerOrderDetails` method

**Current query already includes:**
```java
String sqlOrder =
    "SELECT ID_ORDER, SELLER_NAMES, SELLER_OWNER, SELLER_ISHYIGA_ACCOUNT, " +
    "       BUYER_ISHYIGA_ACCOUNT, BUYER_OWNER, BUYER_NAMES, BUYER_PHONE, AMOUNT, " +
    "       PAYMENT_NAME, ORDER_STATUS, CURRENCY, DELIVERY_LOCATION, PAYMENT_ID, " +
    "       heure AS CREATED_AT " +
    "FROM order_transaction WHERE ID_ORDER=? LIMIT 1";
```

**Verified:** ✅ Already includes `BUYER_OWNER`

Also includes in response:
```java
buyerAcc        = nz(rs.getString("BUYER_ISHYIGA_ACCOUNT"));
orderBuyerOwner = nz(rs.getString("BUYER_OWNER"));          // ✅ Already here
orderBuyerNames = nz(rs.getString("BUYER_NAMES"));
orderBuyerPhone = nz(rs.getString("BUYER_PHONE"));
order.put("BUYER_ISHYIGA_ACCOUNT", buyerAcc);
order.put("BUYER_OWNER", orderBuyerOwner);                  // ✅ Already here
```

## Database Schema Verification

Verify the column exists:
```sql
SHOW COLUMNS FROM chaos_test.order_transaction LIKE 'BUYER_EMAIL';
```

If it doesn't exist, add it:
```sql
ALTER TABLE chaos_test.order_transaction
ADD COLUMN BUYER_EMAIL VARCHAR(255) DEFAULT NULL AFTER BUYER_OWNER;
```

## Summary

The main issue was in the **frontend priority order**. The fixes applied:

1. ✅ **Frontend orders list**: Changed from `BUYER_NAME ?? BUYER_OWNER` to `BUYER_OWNER ?? BUYER_NAME`
2. ✅ **Frontend order details**: Changed from `BUYER_NAME || buyer?.OWNER` to `BUYER_OWNER || BUYER_NAME`
3. ✅ **WhatsApp message format**: Updated to match cart-summary style with formatted table
4. ⚠️ **Backend `listBuyerOrders`**: Needs update to include all buyer fields
