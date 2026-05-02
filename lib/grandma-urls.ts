/**
 * Grandma route and outbound link registry — edit here for your deployment paths.
 * Boundaries with the rest of the stack: docs/grandma-boundaries.md
 */
/** Grandma shell + API version (bump with releases). */
export const GRANDMA_APP_VERSION = "1.1.0"

export const GRANDMA_PATHS = {
  appRoot: "/grandma",
  /** Buyer order list inside the Grandma UI (not the main-site Buyer Panel). */
  buyerOrders: "/grandma/orders",
  /** Grandma sign-in entry — use `?redirect=` (e.g. `/grandma`) to return after login. */
  login: "/grandma/login",
} as const

/** Pages outside the Grandma UI that we link to (shared app or external). */
export const GRANDMA_OUTBOUND = {
  forgotPassword: "/forgot-password",
  /** Seller onboarding entry (adjust to your real URL). */
  registerSeller: "/onboarding/crazy-shopping",
  /** Quick MoMo / USSD flow (Umuriro boarding). */
  umuriro: "/register/umuriro",
} as const

/** Drives `/grandma/login` “Register” link: last MODE choice in settings (buyer vs seller intent). */
export const GRANDMA_SIGNUP_ROLE_LS_KEY = "grandma:signupRole" as const
export type GrandmaSignupRole = "buyer" | "seller"

export function readGrandmaSignupRole(): GrandmaSignupRole {
  if (typeof window === "undefined") return "buyer"
  try {
    return localStorage.getItem(GRANDMA_SIGNUP_ROLE_LS_KEY) === "seller" ? "seller" : "buyer"
  } catch {
    return "buyer"
  }
}

export function writeGrandmaSignupRole(role: GrandmaSignupRole): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(GRANDMA_SIGNUP_ROLE_LS_KEY, role)
  } catch {
    /* ignore */
  }
}
