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
 * Features:
 * - Waits for localStorage rehydration before checking auth
 * - Shows loading spinner during rehydration
 * - Redirects to /login if not authenticated
 * - Redirects to / if user is not admin
 * - Only renders children when authenticated admin user confirmed
 */
export function AdminGuard({ children }: AdminGuardProps) {
    const router = useRouter()
    const { user, isAuthenticated, checkSession, _hasHydrated } = useAuthStore()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Wait for localStorage to rehydrate
        if (!_hasHydrated) {
            return
        }

        // Check session validity (handles inactivity timeout)
        const sessionValid = checkSession()

        if (!sessionValid || !isAuthenticated) {
            console.log('🔒 No valid session, redirecting to login')
            router.push('/login')
            return
        }

        if (user?.role !== 'admin') {
            console.log('⛔ Not authorized as admin, redirecting to home')
            router.push('/')
            return
        }

        // All checks passed, show content
        setIsLoading(false)
    }, [_hasHydrated, isAuthenticated, user, checkSession, router])

    // Show loading until rehydration completes and auth is verified
    if (!_hasHydrated || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-6 text-lg text-gray-600 font-medium">Loading admin panel...</p>
                    <p className="mt-2 text-sm text-gray-500">Verifying authentication</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
