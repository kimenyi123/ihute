# Category AI – Enhancements and Upgrade Guide

This document explains the **category_ai** route, what was added, and how other developers can upgrade their code or adopt the enhanced behaviour.

---

## 1. What is category_ai?

**category_ai** is a **copy** of the category page (`/category/[categoryId]`) intended for enhancements (e.g. AI features, improved UX) without touching the original category flow.

- **Original:** `/category/pharmacy` → `app/category/[categoryId]/page.tsx` + `CategoryClient`
- **Enhanced:** `/category_ai/pharmacy` → `app/category_ai/[categoryId]/page.tsx` + `CategoryClientAI`

**Landing:** Open **http://localhost:3000/category_ai** to use the new flow. That page shows a category grid; clicking a category sends you to `/category_ai/[categoryId]`. The existing home page (`/`) and its category links are unchanged.

---

## 2. What was created (files and structure)

| What | Location | Role |
|------|----------|------|
| **Landing page** | `app/category_ai/page.tsx` | Entry point: visit **/category_ai** to see the category grid; clicking a category goes to `/category_ai/[categoryId]`. |
| **Category grid (AI)** | `components/category_ai/category-grid-ai.tsx` | Same as homepage category grid but links to `/category_ai/[categoryId]` instead of `/category/[categoryId]`. |
| **Page (route)** | `app/category_ai/[categoryId]/page.tsx` | Server component: layout (Header, Breadcrumbs, Footer) and renders `CategoryClientAI`. |
| **Client UI** | `components/category_ai/category-client-ai.tsx` | Client component: supplier selection, product grid, URL state. **This is where to add enhancements.** |
| **Shared (unchanged)** | `components/business-list.tsx`, `components/product-grid.tsx` | Used by both `CategoryClient` and `CategoryClientAI`. No copy was made. |
| **Shared (unchanged)** | `components/header.tsx`, `components/breadcrumbs.tsx`, `components/footer.tsx` | Layout; used by both category and category_ai. |

So:

- **New:** only the `category_ai` route and `CategoryClientAI`.
- **Reused:** `BusinessList`, `ProductGrid`, layout components, `usePrefsStore`, and all existing APIs.

---

## 3. What changed compared to the original category page

- **URL:** `/category/[categoryId]` → `/category_ai/[categoryId]` (e.g. `/category_ai/pharmacy`).
- **Component:** `CategoryClient` → `CategoryClientAI` (same props: `categoryId`, `categoryName`).
- **Logic:** Currently identical (supplier selection, URL sync, scroll to products). All future enhancements go in `CategoryClientAI` (and optionally in dedicated components under `components/category_ai/`).

No API routes, shared components, or store logic were modified.

---

## 4. How to enhance the category_ai page

- **Main place to edit:** `components/category_ai/category-client-ai.tsx`.
  - Add state, effects, or new UI here.
  - You can keep using `BusinessList` and `ProductGrid`, or replace them with AI-specific versions (e.g. `components/category_ai/business-list-ai.tsx`, `product-grid-ai.tsx`) if you need different behaviour only for category_ai.
- **Page layout (title, breadcrumb):** `app/category_ai/[categoryId]/page.tsx`.
  - Same `categoryNames` map as the original; add new categories there if needed.
- **APIs:** Use existing endpoints (e.g. `fetchSuggestions`) or add new ones under `app/api/...` and call them from `CategoryClientAI`.

---

## 5. How developers can “upgrade” or adopt the enhancements

### Option A – Use category_ai as the main experience

- Point navigation/links to `/category_ai/[categoryId]` instead of `/category/[categoryId]` (e.g. homepage category grid, search results).
- Leave `/category/...` in place for backward compatibility or deprecate it later.

### Option B – Bring enhancements back into the original category

1. Copy the enhanced logic/UI from `CategoryClientAI` (and any `components/category_ai/*`) into `CategoryClient` (and optionally into `business-list.tsx` / `product-grid.tsx`).
2. Or refactor shared logic into hooks/components used by both:
   - e.g. `useCategorySuppliers(categoryId)`, `useCategoryProducts(...)` in `lib/` or `hooks/`.
   - Then both `CategoryClient` and `CategoryClientAI` call the same hooks; only the “extra” AI/UX lives in `CategoryClientAI` until you move it.

### Option C – Add AI-only behaviour that stays in category_ai

- Keep all new behaviour in `components/category_ai/` and `CategoryClientAI`.
- No change to existing `category-client.tsx`, `business-list`, or `product-grid`; other devs can use category_ai only where needed (e.g. “Try enhanced view” link).

---

## 6. Quick reference

| Goal | Where to look / what to do |
|------|----------------------------|
| Change category_ai layout (header, breadcrumb) | `app/category_ai/[categoryId]/page.tsx` |
| Add AI or UX enhancements | `components/category_ai/category-client-ai.tsx` |
| Add category_ai-specific list/grid | New components in `components/category_ai/`, then use them in `CategoryClientAI` |
| Use same behaviour as original category | Keep using `BusinessList` and `ProductGrid` in `CategoryClientAI` |
| Roll out enhancements to everyone | Option B above: copy or refactor into `CategoryClient` and shared components |
| Link users to the enhanced page | Use `/category_ai/[categoryId]` in nav/links |

---

## 7. Summary

- **category_ai** = new route + new client component that reuses existing list/grid and APIs.
- **Changes:** new files only; no modifications to the original category page or shared components.
- **Enhancements:** implement in `CategoryClientAI` (and optionally under `components/category_ai/`).
- **Upgrade path:** either switch links to `category_ai`, or copy/refactor from `CategoryClientAI` back into the original category and shared code.
