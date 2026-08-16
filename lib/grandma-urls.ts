/**
 * Grandma route and outbound link registry — edit here for your deployment paths.
 * Boundaries with the rest of the stack: docs/grandma-boundaries.md
 */
/** Grandma shell + API version (bump with releases). */
export const GRANDMA_APP_VERSION = "1.1.3"

export const GRANDMA_PATHS = {
  appRoot: "/grandma",
  /** Buyer order list inside the Grandma UI (not the main-site Buyer Panel). */
  buyerOrders: "/grandma/orders",
  /** Client suggestion / support form. */
  support: "/grandma/support",
  /** Grandma sign-in entry — use `?redirect=` (e.g. `/grandma`) to return after login. */
  login: "/grandma/login",
  /** Dedicated Grandma registration (not main `/register/web-form`). */
  registerForm: "/grandma/register-form",
} as const

/** Pages outside the Grandma UI that we link to (shared app or external). */
export const GRANDMA_OUTBOUND = {
  forgotPassword: "/forgot-password",
  /** Seller registration — Grandma-owned route (query selects seller boarding). */
  registerSeller: "/grandma/register-form?role=seller",
  /** Quick MoMo / USSD flow (Umuriro boarding). */
  umuriro: "/register/umuriro",
} as const

/** Drives `/grandma/login` “Register” link: last MODE choice in settings (buyer vs seller intent). */
export const GRANDMA_SIGNUP_ROLE_LS_KEY = "grandma:signupRole" as const
export type GrandmaSignupRole = "buyer" | "seller"

/** Canonical Grandma register URL. Extra query keys (e.g. shopId, step) are preserved. */
export function grandmaRegisterFormHref(
  role: GrandmaSignupRole = "buyer",
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ role })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && String(v).trim() !== "") params.set(k, String(v))
    }
  }
  return `${GRANDMA_PATHS.registerForm}?${params.toString()}`
}

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
