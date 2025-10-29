/** Buyer's orders (by email preferred, falling back to buyerAccount param) */
private void listBuyerOrders(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    String email        = nz(req.getParameter("email"));
    String buyerAccount = nz(req.getParameter("buyerAccount"));

    String ishyiga = buyerAccount;
    if (ishiygaBlank(ishyiga) && !email.isEmpty()) {
        users u = DbHandler.getOneUser(email);
        if (u != null) ishyiga = nz(u.ISHYIGA_ACCOUNT);
    }
    if (ishiygaBlank(ishyiga)) {
        resp.getWriter().write(err("buyer email or buyerAccount required"));
        return;
    }

    JSONArray arr = new JSONArray();
    String sql =
    "SELECT ID_ORDER, SELLER_ISHYIGA_ACCOUNT, SELLER_NAMES, " +
    "BUYER_ISHYIGA_ACCOUNT, BUYER_OWNER, BUYER_NAMES, BUYER_PHONE, BUYER_EMAIL, " +  // ✅ Fixed: Added all buyer fields
    "DELIVERY_LOCATION, PAYMENT_NAME, PAYMENT_ID, ORDER_STATUS, REKISIYO_STATUS, REFERENCE, " +
    "AMOUNT, CURRENCY, heure AS CREATED_AT " +
    "FROM order_transaction " +
    "WHERE BUYER_ISHYIGA_ACCOUNT = ? " +
    "ORDER BY ID_ORDER DESC";

    try (Connection c = MySQLConnector.mpa();
         PreparedStatement ps = c.prepareStatement(sql)) {
        ps.setString(1, ishyiga);
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                JSONObject o = new JSONObject();
                o.put("ID_ORDER", rs.getInt("ID_ORDER"));
                o.put("SELLER_ISHYIGA_ACCOUNT", nz(rs.getString("SELLER_ISHYIGA_ACCOUNT")));
                o.put("SELLER_NAMES", nz(rs.getString("SELLER_NAMES")));
                o.put("BUYER_ISHYIGA_ACCOUNT", nz(rs.getString("BUYER_ISHYIGA_ACCOUNT")));
                o.put("BUYER_OWNER", nz(rs.getString("BUYER_OWNER")));      // ✅ Guest name here
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
        }
    }

    resp.getWriter().write(new JSONObject().put("ok", true).put("orders", arr).toString());
}
