'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth-store'
import { isAdminUser } from '@/lib/auth-login-client'

interface AdminGuardProps {
    children: React.ReactNode
}

/**
 * AdminGuard - Protects /admin/* and /admin_grandma/*
 *
 * Requires Java account with TYPE/role ADMIN (see isAdminUser).
 */
export function AdminGuard({ children }: AdminGuardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { user, isAuthenticated, checkSession, hasHydrated } = useAuthStore()
    const [denyReason, setDenyReason] = useState<'session' | 'not_admin' | null>(null)

    const adminTarget =
        pathname?.startsWith('/admin') ? pathname : '/admin/dashboard'

    const hydrated = hasHydrated
    const isAdmin = isAdminUser(user)
    // Do not call checkSession() during render (it may logout). Effect below enforces expiry.
    const allowed = hydrated && isAuthenticated && isAdmin && denyReason !== 'session' && denyReason !== 'not_admin'

    useEffect(() => {
        if (!hydrated) return

        setDenyReason(null)
        const sessionValid = checkSession()

        if (!sessionValid || !isAuthenticated) {
            setDenyReason('session')
            router.replace(
                '/login?redirect=' + encodeURIComponent(adminTarget),
            )
            return
        }

        if (!isAdminUser(user)) {
            setDenyReason('not_admin')
            router.replace('/')
        }
    }, [hydrated, isAuthenticated, user, checkSession, router, adminTarget])

    if (!hydrated || !allowed) {
        if (denyReason === 'not_admin') {
            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm font-semibold text-gray-900">Admin access only</p>
                        <p className="mt-2 text-sm text-gray-600">
                            This account is not an admin on the server (needs{' '}
                            <code className="rounded bg-gray-100 px-1">TYPE = ADMIN</code> in Java). Sign in with
                            your admin email or phone linked to an admin account.
                        </p>
                        <Link
                            href="/login?redirect=%2Fadmin%2Fdashboard"
                            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
                        >
                            Sign in as admin
                        </Link>
                    </div>
                </div>
            )
        }

        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-4 border-blue-600"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading admin…</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
