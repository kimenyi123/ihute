/**
 * Guest checkout: stable per-browser email + shared pool (guest_pool@ihute.rw + IHUTE_GUEST).
 * ensure-guest-pool: Java profile lookup, then MySQL INSERT of EMAIL + ISHYIGA_ACCOUNT only (lib/mysql-guest-pool.ts).
 */
const STORAGE_KEY = "ihute_guest_checkout_email"
/** Cached ISHYIGA_ACCOUNT from ensure-guest-pool (all guests share this account). */
export const STORAGE_GUEST_POOL_ISHYIGA = "ihute_guest_pool_ishyiga"

export const DEFAULT_GUEST_ISHYIGA_ACCOUNT = "IHUTE_GUEST"

/**
 * Pool row email in account_signup. Send this as buyerEmail on /api/orders/create for guests so Java finds buyer (not a random guest_* address).
 */
export const GUEST_POOL_EMAIL = "guest_pool@ihute.rw"

/** Cached ISHYIGA_ACCOUNT from ensure-guest-pool, else IHUTE_GUEST. */
export function getGuestBuyerAccount(): string {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STORAGE_GUEST_POOL_ISHYIGA)?.trim()
      if (cached) return cached
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_GUEST_ISHYIGA_ACCOUNT
}

/** Calls ensure-guest-pool (lookup + optional MySQL insert); caches ISHYIGA_ACCOUNT. */
export async function ensureGuestPoolBuyerAccount(): Promise<string> {
  try {
    const res = await fetch("/api/account/ensure-guest-pool", {
      method: "POST",
      cache: "no-store",
    })
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      ishyigaAccount?: string
      error?: string
    }
    if (j?.ok && j.ishyigaAccount) {
      try {
        localStorage.setItem(STORAGE_GUEST_POOL_ISHYIGA, j.ishyigaAccount)
      } catch {
        /* ignore */
      }
      return j.ishyigaAccount
    }
  } catch {
    /* ignore */
  }
  return getGuestBuyerAccount()
}

export function getGuestCheckoutEmail(): string {
  if (typeof window === "undefined") {
    return `guest_${Date.now()}@ihute.rw`
  }
  try {
    let v = localStorage.getItem(STORAGE_KEY)
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      v = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}@ihute.rw`
      localStorage.setItem(STORAGE_KEY, v)
    }
    return v
  } catch {
    return `guest_${Date.now()}@ihute.rw`
  }
}
