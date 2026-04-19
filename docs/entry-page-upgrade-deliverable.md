# Entry page upgrade — deliverable summary

Implementation of the 13-point spec to move the entry page from "static catalog" to "retail intelligence platform" feel.

---

## 1. Summary of changes made

### Rename and reframe
- **"Opportunities" → "Smart Picks"** everywhere on the entry page (shop-by menu label and placeholder content). URL/state still use `opportunities` for compatibility.

### Hero and Smart Strip
- **Hero line** added at top of content (category_ai): *"Find anything. Anywhere. Instantly."* with *"Powered by Ishyiga Intelligence"*.
- **Smart Strip** below hero: horizontal pills — **Trending Near You**, **Running Out Fast**, **Best Deals**, **Smart Picks**. Clickable; Smart Picks opens `?shopBy=opportunities`. Horizontally scrollable on mobile.

### Product cards
- **ProductCard** extended with: optional **badges** (Best Price, Nearby, Low Stock, Fast Moving, Discount, Verified Seller), **whyShown** line, **oldPrice** (strikethrough), **ProductTrustSignals** (rating, review count, verified seller). CTA label set to **"Add to Cart"**.
- **ProductBadges** and **ProductTrustSignals** are reusable; they hide when data is absent.

### Search
- Placeholder already: *"🔍 Search products, brands, or scan barcode..."*.
- **Focus state:** `focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary`.
- **Try suggestions** in dropdown when query is empty: *"Try: cheap beer, pharmacy near me, Leffe, wine"* as clickable chips.

### Filter drawer
- Section spacing increased (`gap-8`, `space-y-2` per section).
- Selected chip visibility improved (primary + `shadow-sm`).
- Footer with Clear all / Show products made **sticky** on small screens.

### Nav
- Shop by tab order unchanged: Sector, Category, Brand, All items, Smart Picks, Top Manufacturers, High Margin, High Demand. Spacing set to `gap-2`.

---

## 2. Files touched

| File | Change |
|------|--------|
| `components/category_ai/shop-by-menu.tsx` | Rename Opportunities → Smart Picks; nav spacing |
| `app/category_ai/page.tsx` | Hero block + SmartStrip; strip query param |
| `components/smart-strip.tsx` | **New** — horizontal pill strip |
| `components/product-badges.tsx` | **New** — ProductBadges, ProductTrustSignals |
| `components/product-card.tsx` | Product type extended; badges, whyShown, trust, oldPrice; CTA "Add to Cart" |
| `components/global-search.tsx` | Focus ring; "Try:" suggestions in dropdown |
| `components/product-filters-sheet.tsx` | Section spacing; sticky footer; selected chip shadow |
| `lib/product-filters-store.ts` | (No change; ShopByTab already includes opportunities.) |
| `docs/data-mapping-ui.md` | **New** — UI ↔ backend field mapping |
| `docs/entry-page-upgrade-deliverable.md` | **New** — this deliverable |

---

## 3. Assumptions

- **Smart Strip** pills (Trending, Running Out, Best Deals) use `?strip=<id>` for now; backend can interpret this later for different feeds. Smart Picks goes to `?shopBy=opportunities`.
- **Product badges / whyShown / trust** are optional; when API provides them, pass into existing Product shape and they render. No backend changes required for current cards to work.
- **Hero** is short and subtle (no large banner) as specified.
- **Filter drawer** Apply = "Show products" (navigate to `/search` with params); Reset = "Clear all". Behavior unchanged.

---

## 4. Placeholders waiting for backend

- **Smart Strip:** "Trending Near You", "Running Out Fast", "Best Deals" — UI and `?strip=` param ready; backend can return different lists by strip type.
- **Product badges:** `badges: ProductBadgeType[]` — backend can send e.g. `["nearby", "best-price"]` when data exists.
- **whyShown:** string — e.g. "Recommended near you", "Popular in this sector".
- **Trust:** `rating`, `reviewCount`, `verifiedSeller` — structure in place; hide when absent.
- **Search suggestions:** "Try:" list is static; can later be driven by trending/recent API.

---

## 5. UX notes on what improved

- **First impression:** Hero + Smart Strip make the page feel like a smart, active surface instead of a static list.
- **Discovery:** Search dropdown "Try:" and focus styling make search feel like discovery.
- **Product cards:** Ready for intelligence (badges, reason shown, trust) without clutter when data is missing.
- **Filters:** Clearer grouping and sticky actions improve use on small screens.
- **Naming:** "Smart Picks" aligns the tab with algorithmic value and sets expectation for future content.

Existing routing, query params, and store logic are preserved; no breaking changes to `/category_ai`, `/search`, or filter state.
