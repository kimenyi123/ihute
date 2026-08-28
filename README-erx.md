# IHUTE eRx Market (v4)

The 5-step MoH eRx patient flow on the pharmacy category page
(`/category_ai/pharmacy?browse=erx`), per the validated UX spec
`ihute_erx_sample_v4.html` (CEO + CTO, 28 Aug 2026). Kinyarwanda-first copy is
verbatim in `lib/erx/erx-market-copy.ts`.

## Feature flags

| Flag | Effect |
|---|---|
| `NEXT_PUBLIC_ERX_MARKET=1` | Clicking the eRx tab on the pharmacy category opens the full-screen 5-step flow (Ishyiga-branded header, step rail "Intambwe X/5"). **Off/unset = today's behaviour** (inline lookup + unlock + medicines list only). |
| `NEXT_PUBLIC_ERX_MOCK=1` | Random-response simulator: quotes (FULL/PARTIAL/DECLINED), Seller Central rider offers, spec pharmacies dataset, and the mock eRx record `EP-0317-170` when the MoH HIE is not configured. Demos run with no backend. |

Set both in `.env.local` (dev) or the environment's `.env` (PM2 servers build
on-server, so `NEXT_PUBLIC_*` comes from that clone's `.env`).

## The 5 steps

1. **Fungura urwandiko rw'imiti** — code + unlock on one card. Reuses the LIVE
   `PharmacyErxInput` component and `GET /api/pharmacy/erx-lookup` (identity
   match against MoH HIE required; red two-level personal-data block kept).
2. **Imiti yasabwe** — medicines list (live endpoint) + market-average prices.
3. **Amafarumasi akwegereye** — ALL pharmacies serving the items, closest
   first, ALL preselected. Sort chips Hafi / ★ Amanota / Stock ukuri / Sync.
4. **Ibiciro no kwishyura** — RFQ to all selected; quotes stream in (CALLING /
   YEMEJE / IGICE / NTABWO BIHARI / BYAHAGARITSWE); ABAMAKE per-item cheapest
   panel; "Hagarika guhamagara" cancels pending RFQs only. Pay: 🏠 pharmacy
   delivery / 🏍 🚲 Seller Central rider offers (arrive live) / 🚶 pickup = 0;
   MoMo pay puts the eRx on HOLD (4h auto-release) and notifies every
   responder (chosen → serve; others → closed, release reservation).
5. **Gukurikirana itumiza** — timeline Paid → POS → VSDC invoice → in
   transit/awaiting pickup (auto-advance stops there). Patient taps
   "Imiti yangezeho / Nayifashe", then MUST rate (pharmacy, + rider when one
   carried it) before "Byarangiye".

## API routes

```
GET  /api/pharmacies/nearby?lat&lng
POST /api/erx/orders                          {erxCode, items, pharmacies}
GET  /api/erx/orders/{id}/quotes              (poll; full order snapshot)
POST /api/erx/orders/{id}/stop-calling
GET  /api/erx/orders/{id}/delivery-offers
POST /api/erx/orders/{id}/choose              {pharmacyId}
POST /api/erx/orders/{id}/pay                 {momo, delivery: pharmacy|pickup|riderId}
POST /api/erx/orders/{id}/delivered
POST /api/erx/orders/{id}/rate                {pharmacyStars, riderStars}
```

## Data

`migrations/2026-08-28-erx-market-v4.sql` — orders type/erx columns,
`order_quotes`, `rider_offers`, `ratings`, `pharmacy_metrics` (nightly +
on-event). Phase 1 serves from an in-memory store
(`lib/erx/erx-order-store.ts`); the SQL is the agreed landing shape for the
Kaos write-back.

## Real vs stubbed (10-line summary)

1. Steps 1–2 lookup/unlock: REAL — live MoH HIE endpoint, untouched.
2. Step 3 candidates: REAL list via Kaos `sectorListSuppliers` when mock off; falls back to spec dataset.
3. Candidate metrics (stars / stock_acc / last_sync): STUBBED defaults — needs `pharmacy_metrics` nightly job.
4. RFQ → POS panel: STUBBED — `lib/erx/erx-pos-channel.ts` posts `type=ERX_RFQ` to OrdersServlet; Kaos must accept it.
5. Quotes: MOCK simulator (time-based, random FULL/PARTIAL/DECLINED); real = POS confirm/decline write-back.
6. Rider offers: MOCK (0–2 random offers); real = Seller Central rider marketplace feed.
7. MoMo payment: STUBBED — `adapters/momo.ts` mints a ref; TODO wire MTN Collections request-to-pay.
8. Post-pay responder notify (serve/release): STUBBED on the same POS channel call.
9. eRx 4h HOLD + tracking timeline: state real in the store; stages 1–3 auto-advance on mock cadence, real = POS/VSDC events.
10. Ratings: persisted in the store + API; MySQL `ratings` table ready in the migration, write-through TODO.
