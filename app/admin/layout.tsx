"use client"

import { ReactNode, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FolderTree,
  CreditCard,
  ShoppingCart,
  Package,
  Image,
  Bell,
  BarChart3,
  Menu,
  X,
  LogOut,
  Wallet,
  MapPin,
  ScrollText,
  Store,
  Boxes,
  Pill,
  MessageSquare,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { AdminGuard } from '@/components/auth/admin-guard'
import { AdminOrderBell } from '@/components/admin/admin-order-bell'

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/sellers', label: 'Sellers', icon: Users },
  { href: '/admin/categories', label: 'Categories & Sectors', icon: FolderTree },
  { href: '/admin/commission', label: 'Commission & Billing', icon: CreditCard },
  { href: '/admin/orders', label: 'Order Monitor', icon: ShoppingCart },
  { href: '/admin/products', label: 'Product Moderation', icon: Package },
  { href: '/admin/prescription-review', label: 'Prescription review', icon: Pill },
  { href: '/admin/content', label: 'Content Manager', icon: Image },
  { href: '/admin/notifications', label: 'Notification Center', icon: Bell },
  { href: '/admin/client-suggestions', label: 'Client Suggestions', icon: MessageSquare },
  { href: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { href: '/admin/activity-logs', label: 'Visitor Tracking', icon: ScrollText },
  { href: '/admin/ihute-stats', label: 'Shop-with-me Sales', icon: Store },
  { href: '/admin/sellers-stock', label: 'Sellers with stock', icon: Boxes },
  { href: '/admin/payment', label: 'Payment Dashboard', icon: Wallet },
  { href: '/admin/gps', label: 'GPS Management', icon: MapPin },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen, closeSidebar])

  // Match supplier shell: desktop sidebar open by default, phone closed.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = () => setSidebarOpen(mql.matches)
    syncSidebar()
    mql.addEventListener('change', syncSidebar)
    return () => mql.removeEventListener('change', syncSidebar)
  }, [])

  const headerTitle =
    user?.name?.trim() ||
    user?.email?.trim() ||
    'Admin Panel'

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h1 className="truncate pr-2 text-lg font-bold text-slate-900">{headerTitle}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <AdminOrderBell />
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <div className="flex">
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200',
              'transform transition-transform duration-300 ease-in-out',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="flex h-full flex-col overflow-y-auto">
              <div className="hidden border-b border-slate-200 p-6 lg:block">
                <h2 className="text-2xl font-bold text-slate-900">Admin Panel</h2>
                <p className="mt-1 text-sm text-slate-500">Ihute Platform</p>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      item.href === '/admin/payment'
                        ? pathname === '/admin/payment' || pathname.startsWith('/admin/payment/')
                        : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeSidebar}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200',
                            isActive
                              ? 'bg-slate-200 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          <Icon size={20} />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="border-t border-slate-200 p-4">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => {
                    logout()
                    router.push('/login')
                    closeSidebar()
                  }}
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={closeSidebar}
              aria-hidden="true"
            />
          )}

          <main
            className={cn(
              "min-w-0 flex-1 transition-[padding] duration-300 lg:overflow-y-auto",
              sidebarOpen && "lg:pl-64",
            )}
          >
            <div className="p-4 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
