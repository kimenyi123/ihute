"use client"

import { ReactNode, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { AdminGuard } from '@/components/auth/admin-guard'

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/sellers', label: 'Sellers', icon: Users },
  { href: '/admin/categories', label: 'Categories & Sectors', icon: FolderTree },
  { href: '/admin/commission', label: 'Commission & Billing', icon: CreditCard },
  { href: '/admin/orders', label: 'Order Monitor', icon: ShoppingCart },
  { href: '/admin/products', label: 'Product Moderation', icon: Package },
  { href: '/admin/content', label: 'Content Manager', icon: Image },
  { href: '/admin/notifications', label: 'Notification Center', icon: Bell },
  { href: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { href: '/admin/payment', label: 'Payment Dashboard', icon: Wallet },
  { href: '/admin/gps', label: 'GPS Management', icon: MapPin },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  // Close sidebar with Escape key on mobile / when overlay is open
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

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`
            fixed inset-y-0 left-0 z-50
            w-64 bg-white border-r border-gray-200
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
          `}
          >
            <div className="h-full flex flex-col overflow-y-auto">
              {/* Logo/Header */}
              <div className="p-6 border-b border-gray-200 hidden lg:block">
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-500 mt-1">Ihute Platform</p>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeSidebar}
                          className={`
                          flex items-center gap-3 px-4 py-3 rounded-lg
                          transition-colors duration-200
                          ${isActive
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                        `}
                        >
                          <Icon size={20} />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
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

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={closeSidebar}
              aria-hidden="true"
            />
          )}

          {/* Main Content */}
          <main className="flex-1 lg:ml-0">
            <div className="p-4 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
