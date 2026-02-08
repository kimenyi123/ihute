# Orders backend contract (OrdersServlet)

When creating an order, **do not validate that each item “exists”** (e.g. lookup by `itemCode` in a catalog).

**Reason:** In this e‑commerce flow, users can only add to cart items that already exist (items with quantity). So every item in the order payload has already been validated on the frontend. The backend should accept the order using the provided `items` (name, itemCode, qty, unitPrice, unit) without an extra “item exists” check.

If the backend currently returns errors like `Item not found: <itemCode>`, remove or skip that validation for order creation so checkout succeeds for cart items.
