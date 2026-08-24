# Production Fix Baseline Report (Phase 0)

**Date**: 2026-08-18  
**Project**: Ihute (Next.js Frontend + Java Tomcat Backend)  
**Scope**: GPS Geolocation, Near Me, Global Search, Redis Caching, Environment Parity  

---

## 1. Repository & Framework Baseline

* **Frontend Framework**: Next.js 16.1.6 (React 19.2.4, Turbopack/Webpack hybrid)
* **Backend Framework**: Java Servlets (Apache Tomcat WAR deployment, `Trading.war` / `/Trading`)
* **Data Stores**: MySQL (`account_seller`, `account_signup`, `seller_add_stock`, `niki_items`), Redis Cache (`Jedis` pool + `ioredis` / `@upstash/redis`)
* **State Management**: Zustand with `localStorage` persistence (`location-storage`, `location-storage-enhanced`)

---

## 2. Baseline Status of Audited Components

| Component | Status | Identified Baseline Faults |
| :--- | :--- | :--- |
| **Near Me Service** | ❌ Broken | Missing `WHERE` in `NearbySupplierService.java` (lines 121, 255); leading space in `" radiusKm"` parameter in `fetchSuggestions.java:9598`. |
| **Global Search Proxy** | ❌ Broken in Prod | `new URL("/fetchSuggestions", backendBase)` in `global-search/route.ts:25` strips `/Trading` context path, returning 404 in production. |
| **GPS Geocoding Write** | ⚠️ Misaligned | `updateSupplierGPS` in `fetchSuggestions.java:4290` updates `account_signup` while all Near Me readers query `account_seller`. |
| **Category Search** | ⚠️ Restricted | `AND (PREFEREDCATEGORIES='pharmacy')` hardcoded in `fetchSuggestions.java:1347, 2377` filters out non-pharmacy suppliers in global search. |
| **Near Me API Routes** | ⚠️ Fragmented | Two competing actions: `action=getNearbySuppliers` and `action=getNearestSuppliers` with conflicting parameter sets (`lat/lng/radiusKm` vs `latitude/longitude/radius`). |
| **Browser Geolocation** | ⚠️ Unmarked Fallback | `use-geolocation.ts` falls back to Kigali (`-1.9536, 30.0906`) on permission denial without exposing an `isFallback` flag to distinguish real GPS from default coordinates. |

---

## 3. Execution Strategy

We will proceed in controlled phases:
1. **Phase 1**: Fix all confirmed code bugs (SQL syntax, URL resolution, parameter typo, dual-table GPS persistence).
2. **Phase 2**: Unify Near Me API contracts and harden client-side geolocation.
3. **Phase 3**: Remove unintended pharmacy category restrictions and refine search relevance/deduplication.
4. **Phase 4**: Ensure database coordinate integrity and complete environment standardization.
