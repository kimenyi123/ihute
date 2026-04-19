'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'

interface AdminGuardProps {
    children: React.ReactNode
}

/**
 * AdminGuard - Protects admin routes from unauthorized access
 *
 * - Waits for Zustand persist hydration (same pattern as supplier guarded pages)
 * - Redirects to /login if not authenticated or session expired
 * - Redirects to / if user is not admin
 * - Renders children only when an authenticated admin session is confirmed (no flash of dashboard)
 */
export function AdminGuard({ children }: AdminGuardProps) {
    const router = useRouter()
    const { user, isAuthenticated, checkSession, loginTime, sessionTimeout } = useAuthStore()
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        const setNow = () => setHydrated(true)
        setHydrated(!!useAuthStore.persist?.hasHydrated?.())
        const unsub = useAuthStore.persist?.onFinishHydration?.(setNow)
        return () => {
            unsub?.()
        }
    }, [])

    const sessionFresh =
        loginTime != null && Date.now() - loginTime <= sessionTimeout

    const allowed =
        hydrated &&
        isAuthenticated &&
        user?.role === 'admin' &&
        sessionFresh

    useEffect(() => {
        if (!hydrated) {
            return
        }

        const sessionValid = checkSession()

        if (!sessionValid || !isAuthenticated) {
            router.replace('/login')
            return
        }

        if (user?.role !== 'admin') {
            router.replace('/')
        }
    }, [hydrated, isAuthenticated, user?.role, checkSession, router])

    if (!hydrated || !allowed) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
