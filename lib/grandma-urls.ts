/**
 * Grandma route and outbound link registry — edit here for your deployment paths.
 * Boundaries with the rest of the stack: docs/grandma-boundaries.md
 */
export const GRANDMA_PATHS = {
  appRoot: "/grandma",
  login: "/grandma/login",
} as const

/** Pages outside the Grandma UI that we link to (shared app or external). */
export const GRANDMA_OUTBOUND = {
  forgotPassword: "/forgot-password",
  /** Seller onboarding entry (adjust to your real URL). */
  registerSeller: "/onboarding/crazy-shopping",
} as const
