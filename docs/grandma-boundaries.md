# Grandma (Ihute) — what lives outside this UI

Grandma is the Next.js surface under `/grandma`. Sign-in is the shared app page **`/login`** (with optional `?redirect=/grandma` to return here). The old path `/grandma/login` redirects to `/login`. These systems are **not** implemented inside Grandma UI; Grandma only calls them or links out.

## Backend / APIs (Kaos Java, deployed WAR)

- **Auth:** `POST …/Kaos/user-auth` (`action=login`, etc.) — proxied from Next as `/api/auth/login`.
- **Shop catalog / search:** Grandma Search is `GET /api/grandma/search` → Java `GET {JAVA_BACKEND_BASE}/grandma/search` (`seller_add_stock.ITEM_NAME` + LIVE `account_signup`). Do **not** use `fetchSuggestions` for Grandma product Search. Sector shop browse may still use `GET …/Kaos/sectorListSuppliers` or `GET …/grandma/suppliers/browse`.
- **Grandma REST:** buyers, sellers, stock, inventory, temp items — URLs from `lib/backend-config.ts` / env (`GRANDMA_*`, `JAVA_AUTH_URL`, etc.).

## Database

- **MySQL** (e.g. `chaos_theta`) — used only by Kaos; Next does not open DB connections for Grandma flows in this repo.
- **Grandma “Save to stock” / pending items** use table **`grandma_niki_items_temp`** (`sql/grandma_niki_items_temp.sql`), not legacy `niki_items_temp` where that name already means a different catalog table. If columns are missing on the Grandma table, run `sql/grandma_niki_items_temp_migrate.sql` (MySQL 8.0.29+) or recreate the table.

## Shared app UI (not Grandma-themed)

- **`/login`** — single sign-in (`IshyigaLoginCard`) for buyers, sellers, and admins; use `?redirect=/grandma` from Grandma when you need to land back in the shop space after auth.
- **`/forgot-password`** (Grandma surface: `/forgot-password/grandma`) — password reset linked from Grandma login.
- **Registration is path-owned:** Main → `/register/web-form`; Grandma → `/grandma/register-form` (`GRANDMA_PATHS.registerForm`). No host-based register branching.

## Grandma-owned routes in `GRANDMA_PATHS` (`lib/grandma-urls.ts`).
- Components under `app/grandma/*`, `components/grandma-*`.
- Client prefs: `localStorage` keys such as `grandma:mode`, `grandma:lang`, etc.

When you change hosts or paths, prefer **`lib/backend-config.ts`** (API base) and **`lib/grandma-urls.ts`** (Grandma + outbound links) over scattering URLs in components.
