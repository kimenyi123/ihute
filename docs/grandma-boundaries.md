# Grandma (Ihute) — what lives outside this UI

Grandma is the Next.js surface under `/grandma` and `/grandma/login`. These systems are **not** implemented inside that UI; Grandma only calls them or links out.

## Backend / APIs (Kaos Java, deployed WAR)

- **Auth:** `POST …/Kaos/user-auth` (`action=login`, etc.) — proxied from Next as `/api/auth/login`.
- **Shop catalog / search:** `GET …/Kaos/fetchSuggestions` (`listSuppliersWithProducts`, `globalSearch`, …) — Grandma calls via `getBackendBase()` from `lib/backend-config.ts`.
- **Grandma REST:** buyers, sellers, stock, inventory, temp items — URLs from `lib/backend-config.ts` / env (`GRANDMA_*`, `JAVA_AUTH_URL`, etc.).

## Database

- **MySQL** (e.g. `chaos_theta`) — used only by Kaos; Next does not open DB connections for Grandma flows in this repo.
- **Grandma “Save to stock” / pending items** use table **`grandma_niki_items_temp`** (`sql/grandma_niki_items_temp.sql`), not legacy `niki_items_temp` where that name already means a different catalog table. If columns are missing on the Grandma table, run `sql/grandma_niki_items_temp_migrate.sql` (MySQL 8.0.29+) or recreate the table.

## Shared app UI (not Grandma-themed)

- **`/login`** — default Ishyiga “blue” login card (`IshyigaLoginCard`); general app entry.
- **`/forgot-password`**, **`/register`**, **`/onboarding/crazy-shopping`** — linked from Grandma login as configured in `lib/grandma-urls.ts` (`GRANDMA_OUTBOUND`).

## Grandma-owned- Routes in `GRANDMA_PATHS` (`lib/grandma-urls.ts`).
- Components under `app/grandma/*`, `components/grandma-*`, `components/grandma-login-form.tsx`.
- Client prefs: `localStorage` keys such as `grandma:mode`, `grandma:lang`, etc.

When you change hosts or paths, prefer **`lib/backend-config.ts`** (API base) and **`lib/grandma-urls.ts`** (Grandma + outbound links) over scattering URLs in components.
