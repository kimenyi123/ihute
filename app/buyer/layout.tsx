"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ShoppingBag,
  Menu,
  X,
  Home,
  Search,
  ShoppingCart,
  Heart,
  PackageCheck,
  Users,
  PackageSearch,
  Star,
  Eye,
  LogOut,
  FileSpreadsheet,
} from "lucide-react"
import { useCallback, useEffect, useState, type ComponentType } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"
import { Footer } from "@/components/footer"

type NavItem = { name: string; href: string; icon: ComponentType<{ className?: string }> }

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const cartCount = useCartStore((s) => s.getTotalItems())

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [sidebarOpen, closeSidebar])

  const buyerNav: NavItem[] = [
    { name: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard },
    { name: "Order Reports", href: "/buyer/orders", icon: ShoppingBag },
    { name: "Umusada upload", href: "/buyer/umusada/upload", icon: FileSpreadsheet },
  ]

  const shopNav: NavItem[] = [
    { name: "Home", href: "/", icon: Home },
    { name: "Search", href: "/search", icon: Search },
    { name: "Cart", href: "/cart", icon: ShoppingCart },
    { name: "Favorites", href: "/favorites", icon: Heart },
    { name: "Deliveries", href: "/deliveries", icon: PackageCheck },
    { name: "Table orders", href: "/tables", icon: Users },
    { name: "Reorder", href: "/reorder", icon: PackageSearch },
    { name: "Ratings", href: "/ratings", icon: Star },
    { name: "Price watch", href: "/price-watch", icon: Eye },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"))

  const NavBlock = ({ title, items }: { title: string; items: NavItem[] }) => (
    <div className="space-y-1">
      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 first:pt-0">
        {title}
      </p>
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={closeSidebar}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100",
              active && "bg-slate-200 font-semibold text-slate-900"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.name}</span>
            {item.href === "/cart" && cartCount > 0 && (
              <span className="rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white">{cartCount}</span>
            )}
          </Link>
        )
      })}
    </div>
  )

  const handleLogout = () => {
    logout()
    setTimeout(() => {
      window.location.href = "/"
    }, 0)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Single mobile top bar: home logo + buyer label + menu (no second global header) */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2" onClick={closeSidebar}>
          <Image
            src="/images/ishyiga-logo.png"
            alt="Home"
            width={88}
            height={28}
            className="h-7 w-auto shrink-0"
          />
          <span className="truncate text-sm font-semibold text-slate-800">Buyer</span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r bg-white p-4 transition-transform duration-300 ease-in-out lg:static lg:h-auto lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "top-[52px] h-[calc(100vh-52px)] overflow-y-auto lg:top-0 lg:h-auto lg:max-h-none lg:overflow-visible"
          )}
        >
          <Link href="/" className="mb-4 hidden items-center gap-2 lg:flex" onClick={closeSidebar}>
            <Image
              src="/images/ishyiga-logo.png"
              alt="Home"
              width={96}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <h2 className="mb-3 hidden text-lg font-semibold text-slate-800 lg:block">Buyer panel</h2>

          <NavBlock title="Your account" items={buyerNav} />
          <NavBlock title="Shop" items={shopNav} />

          <button
            type="button"
            onClick={() => {
              handleLogout()
              closeSidebar()
            }}
            className="mt-6 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            style={{ top: "52px" }}
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </div>
    </div>
  )
}
