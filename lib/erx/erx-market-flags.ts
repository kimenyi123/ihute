/**
 * eRx Market (steps 3–5 of the MoH eRx patient flow) feature flags.
 *
 * NEXT_PUBLIC_ERX_MARKET=1 — enables the 5-step eRx market UI on the pharmacy
 *   category page. Flag off (or unset) = today's behaviour (lookup + unlock +
 *   medicines list only). See README-erx.md.
 * NEXT_PUBLIC_ERX_MOCK=1 — random-response simulator (quotes, rider offers,
 *   mock eRx record when MoH HIE is not configured) so demos run with no backend.
 */

export const ERX_MARKET_ENABLED = process.env.NEXT_PUBLIC_ERX_MARKET === "1"

export const ERX_MOCK_ENABLED = process.env.NEXT_PUBLIC_ERX_MOCK === "1"
