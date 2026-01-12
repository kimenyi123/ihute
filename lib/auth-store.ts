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
  phone: string
  location: string
  businessName?: string
  businessCategory?: string
  ishyigaAccount?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loginTime: number | null
  lastActivityTime: number | null  // Track last activity for inactivity timeout
  sessionTimeout: number
  _hasHydrated: boolean  // Track localStorage rehydration
  login: (user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  checkSession: () => boolean
  updateActivity: () => void  // Update last activity time
  setSessionTimeout: (timeout: number) => void
}

// Role-specific timeout durations
const SESSION_TIMEOUTS = {
  admin: 15 * 60 * 1000,      // 15 minutes for admin (security)
  staff: 24 * 60 * 60 * 1000, // 24 hours for staff
  customer: 24 * 60 * 60 * 1000, // 24 hours for customers
  supplier: 24 * 60 * 60 * 1000, // 24 hours for suppliers
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      lastActivityTime: null,
      sessionTimeout: 24 * 60 * 60 * 1000, // Default 24 hours
      _hasHydrated: false,  // Initially false, set to true after rehydration

      login: (user) => {
        const now = Date.now()
        const timeout = SESSION_TIMEOUTS[user.role] || SESSION_TIMEOUTS.customer

        set({
          user,
          isAuthenticated: true,
          loginTime: now,
          lastActivityTime: now,  // Set initial activity time
          sessionTimeout: timeout
        })

        console.log(`✅ User logged in as ${user.role}. Session timeout: ${timeout / 60000} minutes`)

        // Merge anonymous session interactions to user account
        if (typeof window !== "undefined") {
          mergeSessionToUser(user.email).catch((err) => {
            console.warn("Failed to merge session interactions:", err)
          })
        }
      },

      logout: () => {
        console.log("🔒 User logged out")
        // Clear extra app storages
        if (typeof window !== "undefined") {
          localStorage.removeItem("cart-storage")
          localStorage.removeItem("favorites-storage")
          localStorage.removeItem("orders-storage")
          localStorage.removeItem("prefs-storage")
          sessionStorage.clear()
        }
        set({ user: null, isAuthenticated: false, loginTime: null, lastActivityTime: null })
      },

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      checkSession: () => {
        const state = get()
        if (!state.isAuthenticated || !state.lastActivityTime) {
          return false
        }

        const now = Date.now()
        const timeSinceLastActivity = now - state.lastActivityTime
        const sessionExpired = timeSinceLastActivity > state.sessionTimeout

        if (sessionExpired) {
          const minutesInactive = Math.floor(timeSinceLastActivity / 60000)
          console.log(`⏰ Session expired after ${minutesInactive} minutes of inactivity`)
          state.logout()
          return false
        }

        return true
      },

      // Update last activity time (call this on any user interaction)
      updateActivity: () => {
        const state = get()
        if (state.isAuthenticated) {
          set({ lastActivityTime: Date.now() })
        }
      },

      setSessionTimeout: (timeout) => set({ sessionTimeout: timeout }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Set hydration flag when localStorage rehydration completes
        state._hasHydrated = true
      },
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        loginTime: s.loginTime,
        lastActivityTime: s.lastActivityTime,  // Persist activity time
        sessionTimeout: s.sessionTimeout,
      }),
    }
  )
)
