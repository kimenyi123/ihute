// lib/auth-store.ts
"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mergeSessionToUser } from "./interaction-tracker"

export type UserRole = "buyer" | "seller" | "admin" | "staff"

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
  lastActivityTime: number | null
  sessionTimeout: number

  // ✅ one hydration flag + setter
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void

  login: (user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  checkSession: () => boolean
  updateActivity: () => void
  setSessionTimeout: (timeout: number) => void
}

const SESSION_TIMEOUTS: Record<UserRole, number> = {
  admin: 15 * 60 * 1000,
  staff: 24 * 60 * 60 * 1000,
  buyer: 24 * 60 * 60 * 1000,
  seller: 24 * 60 * 60 * 1000,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      lastActivityTime: null,
      sessionTimeout: 24 * 60 * 60 * 1000,

      // ✅ hydration flag
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: (user) => {
        const now = Date.now()
        const timeout = SESSION_TIMEOUTS[user.role] ?? SESSION_TIMEOUTS.buyer

        set({
          user,
          isAuthenticated: true,
          loginTime: now,
          lastActivityTime: now,
          sessionTimeout: timeout,
        })

        if (typeof window !== "undefined") {
          mergeSessionToUser(user.email).catch((err) => {
            console.warn("Failed to merge session interactions:", err)
          })
        }
      },

      logout: () => {
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

        // ✅ don’t invalidate session until hydration is done
        if (!state.hasHydrated) return true

        if (!state.isAuthenticated || !state.lastActivityTime) return false

        const now = Date.now()
        const sessionExpired = now - state.lastActivityTime > state.sessionTimeout

        if (sessionExpired) {
          state.logout()
          return false
        }

        return true
      },

      updateActivity: () => {
        const state = get()
        if (state.isAuthenticated) set({ lastActivityTime: Date.now() })
      },

      setSessionTimeout: (timeout) => set({ sessionTimeout: timeout }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),

      // ✅ IMPORTANT: use setter, don’t mutate state directly
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },

      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        loginTime: s.loginTime,
        lastActivityTime: s.lastActivityTime,
        sessionTimeout: s.sessionTimeout,
      }),
    }
  )
)
