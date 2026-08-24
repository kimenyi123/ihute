# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ihute-frontend` (package name `my-ihute`) is the Next.js 16 (App Router) frontend for **Ihute**, a Rwandan B2B/B2C commerce platform with several distinct surfaces sharing one codebase:

- **Main site** (`ihute.rw`) — buyer/seller/supplier/admin commerce.
- **Grandma** (`shop.ihute.rw`, legacy `grandma.ihute.rw`) — a separate simplified shopping UI under `app/grandma/*`, treated as an isolated sub-product (see `docs/grandma-boundaries.md`).
- **Seller registration** (`seller.ihute.rw`) and **rider registration** (`rider.ihute.rw`) — dedicated host aliases rewritten by `middleware.ts`.

All of these are one Next.js app; routing between them is host/path-based in `middleware.ts`, not separate deployments of separate code.

The real business logic and database access mostly live in an external **Java/Tomcat backend** ("Kaos" servlets, WAR context typically `Trading`). This repo is largely a UI + API-proxy layer in front of that backend, plus a handful of features that talk directly to MySQL/MongoDB/Redis from Next.js server code (see "Direct data access" below).

A Capacitor-wrapped mobile shell (`android/`, `ios/`) simply loads the live Grandma web URL in a WebView — there is no separate mobile codebase to maintain (see `BUILD_MOBILE.md`). A separate Flutter project (`ihute_flutter/`) also exists in-tree but is excluded from lint/build tooling.

## Commands

```bash
npm run dev            # next dev --webpack (default; matches production bundler)
npm run dev:turbo       # next dev with Turbopack
npm run build           # next build
npm run start           # next start (production server)
npm run lint            # eslint .
npm run lint:fix
npm run typecheck       # tsc --noEmit
npm run ci               # lint && typecheck && build — same as CI
```

Node.js `>=20.10.0 <23` is required (`engines` in package.json). `.npmrc` sets `legacy-peer-deps=true` — use plain `npm install`, not `npm ci` with strict peer resolution overridden.

### Tests

There is no single `npm test`. Tests are individual `*.test.ts` files colocated in `lib/` (18 of them, e.g. `lib/geo-haversine.test.ts`, `lib/grandma-search-fuzzy.test.ts`) written against Node's built-in test runner. Run one directly:

```bash
npx tsx --test lib/geo-haversine.test.ts
npx tsx --test lib/some-other-file.test.ts
```

`npm run test:ebm` runs a dedicated EBM script test (`node --experimental-strip-types --test scripts/test-ebm-unit.mjs`). Other one-off `mongo:*` scripts under `npm run` are manual verification scripts, not part of CI.

CI (`.github/workflows/ci.yml` and `bitbucket-pipelines.yml`) only runs lint + typecheck + build — it does **not** run the `*.test.ts` files.

### Mobile

`npm run cap:sync`, `cap:open:android`, `cap:open:ios` wrap the live web app via Capacitor. See `BUILD_MOBILE.md` for full build steps; the default loaded URL is `https://shop.ihute.rw/grandma`, overridable via `CAPACITOR_SERVER_URL`.

## Architecture

### Backend integration is the central concept

Almost nothing in this repo owns its own database directly. Instead, `lib/backend-config.ts` centralizes resolution of the Java backend base URL and every servlet endpoint derived from it (auth, orders, suppliers, grandma buyers/sellers/stock, sector search, payments, etc.). When adding or touching any server-to-Java integration, add/derive the URL there rather than hardcoding hosts in a route handler.

- Backend base resolution order: `JAVA_BACKEND_BASE` → `BACKEND_URL` → `NEXT_PUBLIC_API_URL` (only if it looks like a Trading WAR) → environment default (`http://localhost:8082/Trading` in dev, `https://ihute.rw/Trading` in prod).
- In local dev without an explicit override, `warmJavaBackendBase()` probes several localhost ports/contexts (`8080`/`8082`, `Trading`/`Ihute`/`trading_ai`/etc.) to find a running Tomcat instance.
- `app/api/**` route handlers are largely thin proxies to these Java servlet URLs (auth, orders, suppliers, grandma, payment, search, etc.) — check `lib/backend-config.ts` before assuming a feature needs new server-side persistence logic.
- `next.config.mjs` also has `rewrites()` that proxy some paths (`/supplier/b2b/api/*`, `/api/payment/*`, `/api/payers*`, etc.) straight to the Java base at the Next.js/webserver level, bypassing route handlers entirely — check there too when tracing a request.

### Direct data access (the exceptions)

A few features intentionally bypass the Java backend and talk to databases directly from Next.js server code — these are documented per-feature and should **keep** their own config rather than being routed through Java:

- MongoDB (`MONGO_URI`/`MONGO_DATABASE`/`MONGO_COLLECTION`) — stock-sync logs (`lib/mongo-stock-sync-client.ts`, `app/api/stock-sync/**`).
- MySQL (`ONBOARDING_MYSQL_*`, falling back through `EBM_MYSQL_*` → `FORGOT_PASSWORD_MYSQL_*` → `SUPPLIER_STOCK_MYSQL_*` → `GQ_MYSQL_*` → `MYSQL_*` → `DB_URL`/`DB_USER`/`DB_PASS`) — onboarding drafts, seller GPS persistence, client suggestions, admin grandma seller/draft review, EBM helpers.
- EBM (electronic billing) integration — `GQ_EBM_*` env vars, `lib/ebm/`.
- Redis (`lib/redis.server.ts`, `lib/redis-cache.ts`) — caching layer, notably used by Grandma sector browse.

**Grandma Search specifically must never require MySQL.** `GET /api/grandma/search` proxies only to Java `GET {JAVA_BACKEND_BASE}/grandma/search`; do not add a MySQL dependency to that path (see `docs/grandma-boundaries.md`).

### Multi-surface routing (`middleware.ts`)

Host and path rewrites/redirects decide which surface serves a request:
- `shop.ihute.rw` / `grandma.ihute.rw` → root rewrites to `/grandma`.
- `ihute.rw`/`www.ihute.rw` requests to `/grandma/*` redirect out to `shop.ihute.rw`.
- `seller.ihute.rw` root → `/register/web-form?role=seller`; `rider.ihute.rw` root → `/register/rider`.
- `/login` on a Grandma host/referrer/redirect-target routes to `/grandma/login`; registration path aliases (`/register/buyer`, `/register/grandma-seller`, etc.) canonicalize to `/register/web-form` or `/grandma/register-form`.
- Grandma-vs-main forgot/reset-password pages are chosen by host (or `?surface=grandma` in dev).

When adding cross-surface links or redirects, prefer extending `middleware.ts` / `lib/grandma-urls.ts` (`GRANDMA_PATHS`) rather than hardcoding host checks in components.

### State and data layer conventions

- Global client state uses **Zustand** stores in `lib/*-store.ts` (e.g. `auth-store.ts`, `cart-store.ts`, `product-store.ts`, `favorites-store.ts`, `price-watch-store.ts`), several with `zustand/middleware persist` for localStorage persistence.
- `lib/auth-store.ts` encodes session timeout rules directly as constants: 30 min idle / 2 hr absolute for normal users, 15 min idle for admins, 3 hr for "remember me". Check here before changing session-expiry behavior.
- `types/` holds only a couple of global ambient/shared types; most domain types live alongside their logic in `lib/*.ts` or `lib/types/`.
- UI primitives (shadcn/radix-based) live in `components/ui/`; larger feature components sit flat in `components/` (e.g. `checkout-form.tsx`, `cart-content.tsx`) or in feature subfolders (`components/admin/`, `components/supplier/`, `components/payment/`, `components/urubuto/`, `components/umuriro/`).
- `src/modules/self-order` and `src/components/` hold a small, separate set of self-order/table-command UI — most app code is under the root `lib/`, `components/`, and `app/` directories, not `src/`.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).

### App Router structure (`app/`)

Route groups roughly mirror business roles: `buyer/`, `seller/`, `supplier/`, `admin/` (+ `admin_grandma/`), `grandma/`, `checkout/`, `cart/`, `orders/`, `deliveries/`, `payment/`, `ratings/`, `onboarding/`, plus feature areas like `shop-with-me/`, `shopwithme__ai/`, `category_ai/`, `table-commands` (under `app/api`), `price-watch/`, `reorder/`, `self-order/`. `app/api/` mirrors this by domain (grandma, admin, orders, payment, supplier, stock-sync, etc.) and is mostly Java-backend proxying as described above, with the direct-DB exceptions noted.

### Legacy-codebase lint posture

`eslint.config.mjs` intentionally disables several rules (`no-explicit-any`, `no-unused-vars`, all `react-hooks/*` compiler rules, `no-unescaped-entities`, `no-img-element`, `no-require-imports`, `ban-ts-comment`) with comments noting they should be tightened incrementally rather than fixed wholesale. Don't "fix" these repo-wide as a drive-by; match existing patterns unless a task specifically asks for cleanup in that area.

## Deployment

CI/CD is Bitbucket Pipelines (`bitbucket-pipelines.yml`), not GitHub Actions (GitHub Actions `ci.yml` runs lint/typecheck/build only, no deploy). Four PM2-managed environments run on one DigitalOcean droplet, each its own git clone with its own `.env` (see `ecosystem.config.cjs`, `docs/DEPLOYMENT.md`):

| PM2 name | Path | Host | Branch |
|---|---|---|---|
| `ihute-frontend` | `/var/www/ihute-frontend` | ihute.rw | master/main (manual/production deploy) |
| `ihute-dev` | `/var/www/ihute-frontend-dev` | dev.ihute.rw | master (auto on push) |
| `ihute-beta` | `/var/www/ihute-frontend_beta` | beta.ihute.rw | `beta` |
| `ihute-grandma` | `/var/www/grandma-ihute` | shop.ihute.rw | `GRANDMA` |

Builds run **on the server**, so `NEXT_PUBLIC_*` values come from that environment's own `.env`, not from CI.
