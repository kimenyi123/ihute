// lib/auth-store.ts
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mergeSessionToUser } from "./interaction-tracker"

/** Stale test accounts in persisted storage — must not be sent to AdminServlet. */
const LEGACY_DISCARD_EMAILS = new Set<string>(["admin0799338897@ihute.local"])

/** Idle logout after no activity (sliding). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
/** Hard cap from login time when “Remember me” is off. */
export const ABSOLUTE_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours
/** Stricter idle for admin accounts. */
export const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
/**
 * “Remember me” — common e‑commerce style short extension (not multi-day).
 * Absolute and idle both capped at 3 hours from login / last activity.
 */
export const REMEMBER_ME_TIMEOUT_MS = 3 * 60 * 60 * 1000 // 3 hours

export type UserRole = "customer" | "supplier" | "admin" | "staff"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  /** Raw account_signup TYPE from backend (BUYER | SELLER | ...). */
  dbRole?: string
  /**
   * True when PREFEREDCATEGORIES/DEPARTMENT indicates pharmacy or retail,
   * so the user should be able to view both buyer and seller order views.
   */
  dualPharmacyRetail?: boolean
  /**
   * True when account sector is pharmacy (PREFEREDCATEGORIES/DEPARTMENT contains "pharmacy").
   * Used to hide restaurant-only supplier features (e.g. self-ordering, tables).
   */
  pharmacySector?: boolean
  phone: string
  location: string
  businessName?: string
  businessCategory?: string
  ishyigaAccount?: string
  /** Owner name (e.g. for orders list) */
  owner?: string
  /** Mobile Money (MoMo) payment code */
  momo?: string
  /** Preferred currency (e.g. RWF, USD) */
  currency?: string
  /** Profile or business description */
  description?: string
  /** Display nickname (e.g. for Shop with Me URL) */
  nickname?: string
  /** From Java login when ADMIN_API_SECRET is set — sent to AdminServlet via Next proxy */
  adminApiToken?: string
}

export type LoginOptions = {
  /** Extends session to ~3 hours (still forced logout). Default false. */
  rememberMe?: boolean
  /** @deprecated use rememberMe */
  stayLoggedIn?: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  /** When the user signed in (epoch ms). */
  loginTime: number | null
  /** Last user activity; idle timeout slides from this. */
  lastActivityAt: number | null
  /**
   * Idle window in ms (clamped). Prefer resolving via resolveIdleTimeout();
   * kept for backward compatibility with persisted state.
   */
  sessionTimeout: number
  /** Absolute max session length from loginTime. */
  absoluteTimeout: number
  stayLoggedIn: boolean
  hasHydrated: boolean
  /** Set when checkSession logs the user out for expiry (UI can toast once). */
  sessionExpiredReason: "idle" | "absolute" | null
  login: (user: User, options?: LoginOptions) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  /** Bump the sliding session window (call on interaction; debounce in UI). */
  touchSession: () => void
  checkSession: () => boolean
  clearSessionExpiredReason: () => void
  setSessionTimeout: (timeout: number) => void
}

function isAdminLike(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === "admin" || user.role === "staff") return true
  const db = String(user.dbRole || "").toUpperCase()
  return db === "ADMIN" || db === "STAFF"
}

function clampIdleMs(ms: number, rememberMe: boolean, admin: boolean): number {
  const fallback = rememberMe
    ? REMEMBER_ME_TIMEOUT_MS
    : admin
      ? ADMIN_IDLE_TIMEOUT_MS
      : IDLE_TIMEOUT_MS
  if (!Number.isFinite(ms) || ms <= 0) return fallback
  const max = rememberMe ? REMEMBER_ME_TIMEOUT_MS : Math.max(IDLE_TIMEOUT_MS, ADMIN_IDLE_TIMEOUT_MS)
  const min = 5 * 60 * 1000
  return Math.min(max, Math.max(min, ms))
}

function resolveIdleTimeout(state: {
  stayLoggedIn: boolean
  user: User | null
  sessionTimeout: number
}): number {
  if (state.stayLoggedIn) return REMEMBER_ME_TIMEOUT_MS
  if (isAdminLike(state.user)) return ADMIN_IDLE_TIMEOUT_MS
  return clampIdleMs(state.sessionTimeout || IDLE_TIMEOUT_MS, false, false)
}

function resolveAbsoluteTimeout(state: {
  stayLoggedIn: boolean
  absoluteTimeout: number
}): number {
  if (state.stayLoggedIn) return REMEMBER_ME_TIMEOUT_MS
  const t = state.absoluteTimeout
  if (!Number.isFinite(t) || t <= 0) return ABSOLUTE_TIMEOUT_MS
  return Math.min(ABSOLUTE_TIMEOUT_MS, Math.max(60 * 60 * 1000, t))
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      lastActivityAt: null,
      sessionTimeout: IDLE_TIMEOUT_MS,
      absoluteTimeout: ABSOLUTE_TIMEOUT_MS,
      stayLoggedIn: false,
      hasHydrated: false,
      sessionExpiredReason: null,

      login: (user, options) => {
        const now = Date.now()
        const wantRemember = Boolean(options?.rememberMe ?? options?.stayLoggedIn)
        const admin = isAdminLike(user)
        // Admin never gets remember-me — too risky on shared machines
        const remember = wantRemember && !admin
        set({
          user,
          isAuthenticated: true,
          loginTime: now,
          lastActivityAt: now,
          stayLoggedIn: remember,
          sessionTimeout: remember
            ? REMEMBER_ME_TIMEOUT_MS
            : admin
              ? ADMIN_IDLE_TIMEOUT_MS
              : IDLE_TIMEOUT_MS,
          absoluteTimeout: remember ? REMEMBER_ME_TIMEOUT_MS : ABSOLUTE_TIMEOUT_MS,
          sessionExpiredReason: null,
          hasHydrated: true,
        })

        if (typeof window !== "undefined") {
          mergeSessionToUser(user.email).catch((err) => {
            console.warn("Failed to merge session interactions:", err)
          })
        }
      },

      logout: () => {
        const reason = get().sessionExpiredReason
        set({
          user: null,
          isAuthenticated: false,
          loginTime: null,
          lastActivityAt: null,
          stayLoggedIn: false,
          sessionTimeout: IDLE_TIMEOUT_MS,
          absoluteTimeout: ABSOLUTE_TIMEOUT_MS,
          sessionExpiredReason: reason,
        })
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth-storage")
          localStorage.removeItem("cart-storage")
          sessionStorage.removeItem("cart-storage")
          localStorage.removeItem("favorites-storage")
          localStorage.removeItem("orders-storage")
          localStorage.removeItem("prefs-storage")
          localStorage.removeItem("table-command-storage")
          const expiryFlag = reason ? String(reason) : null
          sessionStorage.clear()
          if (expiryFlag) {
            try {
              sessionStorage.setItem("ihute_session_expired", expiryFlag)
            } catch {
              /* ignore */
            }
          }
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i)
            if (k?.startsWith("grandma:")) localStorage.removeItem(k)
          }
        }
      },

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      touchSession: () => {
        const s = get()
        if (!s.isAuthenticated) return
        set({ lastActivityAt: Date.now() })
      },

      checkSession: () => {
        const state = get()
        if (!state.isAuthenticated || !state.loginTime) return false
        const now = Date.now()
        const idleMs = resolveIdleTimeout(state)
        const absoluteMs = resolveAbsoluteTimeout(state)
        const anchor = state.lastActivityAt ?? state.loginTime

        if (now - state.loginTime > absoluteMs) {
          set({ sessionExpiredReason: "absolute" })
          state.logout()
          return false
        }
        if (now - anchor > idleMs) {
          set({ sessionExpiredReason: "idle" })
          state.logout()
          return false
        }
        return true
      },

      clearSessionExpiredReason: () => set({ sessionExpiredReason: null }),

      setSessionTimeout: (timeout) => {
        const s = get()
        set({
          sessionTimeout: clampIdleMs(timeout, s.stayLoggedIn, isAdminLike(s.user)),
        })
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        loginTime: s.loginTime,
        lastActivityAt: s.lastActivityAt,
        sessionTimeout: s.sessionTimeout,
        absoluteTimeout: s.absoluteTimeout,
        stayLoggedIn: s.stayLoggedIn,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true
          // Legacy 14d/30d “stay logged in” → force normal timeouts (user must opt in again).
          const prevIdle = Number(state.sessionTimeout)
          const prevAbs = Number(state.absoluteTimeout)
          const legacyLong =
            (Number.isFinite(prevIdle) && prevIdle > REMEMBER_ME_TIMEOUT_MS) ||
            (Number.isFinite(prevAbs) && prevAbs > REMEMBER_ME_TIMEOUT_MS)
          const remember =
            Boolean(state.stayLoggedIn) && !isAdminLike(state.user) && !legacyLong
          state.stayLoggedIn = remember
          if (remember) {
            state.sessionTimeout = REMEMBER_ME_TIMEOUT_MS
            state.absoluteTimeout = REMEMBER_ME_TIMEOUT_MS
          } else if (isAdminLike(state.user)) {
            state.sessionTimeout = ADMIN_IDLE_TIMEOUT_MS
            state.absoluteTimeout = ABSOLUTE_TIMEOUT_MS
          } else {
            state.sessionTimeout = IDLE_TIMEOUT_MS
            state.absoluteTimeout = ABSOLUTE_TIMEOUT_MS
          }
        }
        queueMicrotask(() => {
          try {
            const raw =
              typeof window !== "undefined" ? localStorage.getItem("auth-storage") : null
            const p = raw
              ? (JSON.parse(raw) as { state?: { user?: { email?: string | null } | null } })
              : undefined
            const em =
              typeof p?.state?.user?.email === "string" ? p.state!.user!.email!.trim().toLowerCase() : ""
            if (em && LEGACY_DISCARD_EMAILS.has(em)) {
              console.warn("[auth-store] dropping legacy persisted auth:", em)
              try {
                localStorage.removeItem("auth-storage")
              } catch {
                /* ignore */
              }
              useAuthStore.setState({
                user: null,
                isAuthenticated: false,
                loginTime: null,
                lastActivityAt: null,
                stayLoggedIn: false,
                sessionTimeout: IDLE_TIMEOUT_MS,
                absoluteTimeout: ABSOLUTE_TIMEOUT_MS,
                hasHydrated: true,
              })
              return
            }
          } catch (e) {
            console.warn("[auth-store] rehydrate legacy check failed:", e)
          }
          // Expire immediately if persisted session is already stale
          const s = useAuthStore.getState()
          if (s.isAuthenticated) {
            s.checkSession()
          }
          useAuthStore.setState({ hasHydrated: true })
        })
      },
    }
  )
)
