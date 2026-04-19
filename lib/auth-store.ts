// lib/auth-store.ts
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mergeSessionToUser } from "./interaction-tracker"

/** Stale test accounts in persisted storage — must not be sent to AdminServlet. */
const LEGACY_DISCARD_EMAILS = new Set<string>(["admin0799338897@ihute.local"])

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

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loginTime: number | null
  sessionTimeout: number
  hasHydrated: boolean
  login: (user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  checkSession: () => boolean
  setSessionTimeout: (timeout: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      sessionTimeout: 60 * 60 * 1000, // 60 minutes
      hasHydrated: false,

      login: (user) => {
        const now = Date.now()
        set({ user, isAuthenticated: true, loginTime: now, hasHydrated: true })
        
        // Merge anonymous session interactions to user account
        if (typeof window !== "undefined") {
          mergeSessionToUser(user.email).catch((err) => {
            console.warn("Failed to merge session interactions:", err)
          })
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, loginTime: null, hasHydrated: true })
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth-storage")
          localStorage.removeItem("cart-storage")
          sessionStorage.removeItem("cart-storage")
          localStorage.removeItem("favorites-storage")
          localStorage.removeItem("orders-storage")
          localStorage.removeItem("prefs-storage")
          localStorage.removeItem("table-command-storage")
          sessionStorage.clear()
        }
      },

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      checkSession: () => {
        const state = get()
        if (!state.isAuthenticated || !state.loginTime) return false
        const now = Date.now()
        const sessionExpired = now - state.loginTime > state.sessionTimeout
        if (sessionExpired) {
          state.logout()
          return false
        }
        return true
      },

      setSessionTimeout: (timeout) => set({ sessionTimeout: timeout }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        loginTime: s.loginTime,
        sessionTimeout: s.sessionTimeout,
      }),
      onRehydrateStorage: () => (persisted: unknown, error: unknown) => {
        if (error) {
          console.warn("[auth-store] persist rehydrate error:", error)
        }
        queueMicrotask(() => {
          try {
            const p = persisted as
              | { state?: { user?: { email?: string | null } | null } }
              | undefined
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
                hasHydrated: true,
              })
              return
            }
          } catch (e) {
            console.warn("[auth-store] rehydrate legacy check failed:", e)
          }
          useAuthStore.setState({ hasHydrated: true })
        })
      },
    }
  )
)
