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
  sessionToken: string | null // Unique token to prevent cross-browser session sharing

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
  admin: 30 * 60 * 1000, // 30 minutes for admin (increased from 15)
  staff: 24 * 60 * 60 * 1000,
  buyer: 24 * 60 * 60 * 1000,
  seller: 24 * 60 * 60 * 1000,
}

// Generate a unique session token based on browser info + random data
function generateSessionToken(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const screen = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : ''
  return btoa(`${timestamp}-${random}-${userAgent}-${screen}`).substring(0, 64)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loginTime: null,
      lastActivityTime: null,
      sessionTimeout: 24 * 60 * 60 * 1000,
      sessionToken: null,

      // ✅ hydration flag
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: (user) => {
        const now = Date.now()
        const timeout = SESSION_TIMEOUTS[user.role] ?? SESSION_TIMEOUTS.buyer
        const token = generateSessionToken()

        set({
          user,
          isAuthenticated: true,
          loginTime: now,
          lastActivityTime: now,
          sessionTimeout: timeout,
          sessionToken: token,
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
        set({ user: null, isAuthenticated: false, loginTime: null, lastActivityTime: null, sessionToken: null })
      },

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      checkSession: () => {
        const state = get()

        // ✅ don’t invalidate session until hydration is done
        if (!state.hasHydrated) return true

        if (!state.isAuthenticated || !state.lastActivityTime) return false

        // 🔒 Validate session token - prevents cross-browser session sharing
        if (!state.sessionToken) {
          console.warn('Session token missing - logging out for security')
          state.logout()
          return false
        }

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
        sessionToken: s.sessionToken,
      }),
    }
  )
)
