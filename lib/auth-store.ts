// lib/auth-store.ts
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mergeSessionToUser } from "./interaction-tracker"

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
  updateActivity: () => void
  checkSession: () => boolean
  setSessionTimeout: (timeout: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      sessionTimeout: 24 * 60 * 60 * 1000,
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
        set({ user: null, isAuthenticated: false, loginTime: null })
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

      updateActivity: () => {
        const state = get()
        if (state.isAuthenticated) {
          set({ loginTime: Date.now() })
        }
      },

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
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true
        }
      },
    }
  )
)
