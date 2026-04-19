# UI data mapping (product cards & filters)

The entry page and product cards are built to accept the following fields. When the backend sends them, the UI will display badges, trust signals, and “why shown” without further frontend changes.

## Product card fields

| UI use | Backend / DB source | Notes |
|--------|---------------------|--------|
| `name` | `item_commercial_name` / `ITEM_NAME` | Display name |
| `price` | `SALE_PRICE_INCLUSIVE` / `selling_price` | RWF |
| `oldPrice` | Strikethrough when discounted | Optional |
| `image` | `image_url` / `item_image_url` / `IMAGE_URL` | + KAOS from `famille` + `item_key_words` |
| `badges` | Derived or from API | Array of: `best-price`, `nearby`, `low-stock`, `fast-moving`, `discount`, `verified-seller` |
| `whyShown` | From recommendation engine | e.g. "Recommended near you", "Popular in this sector", "Great price today" |
| `rating` | `rating` (niki_items / reviews) | 0–5, optional |
| `reviewCount` | `reviews` or count from DB | Optional |
| `verifiedSeller` | Seller verification flag | Optional |
| `supplierName` | `SELLER_*` / supplier account | Optional |
| `supplierLocation` | Location fields | Optional |
| `itemCode` / `item_code` | `ITEM_CODE` / `niki_code` | For cart and images |

**Safe fallback:** If a field is missing, the card hides that element (e.g. no badges row, no trust line).

## Filter and strip

- **Smart strip** pills (Trending Near You, Running Out Fast, Best Deals, Smart Picks) set `?strip=` or switch `shopBy=opportunities` for Smart Picks. Backend can use these to return different feeds.
- **Filters:** Sector, Category, Brand, Price (min/max), Location — already passed to search; backend can filter by `niki_items` + `seller_add_stock` as in `backend-stock-and-niki-structure.md`.

## Reusable components

- `components/product-badges.tsx` — `ProductBadges`, `ProductTrustSignals`
- `components/smart-strip.tsx` — horizontal pill strip
- `components/product-card.tsx` — accepts all fields above; extend Product type when new fields are added
