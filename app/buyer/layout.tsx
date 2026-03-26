"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ShoppingBag } from "lucide-react"

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const menu = [
    { name: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard },
    { name: "Order Reports", href: "/buyer/orders", icon: ShoppingBag },
    // { name: "Umusada Excel", href: "/buyer/umusada/upload", icon: FileSpreadsheet },
  ]

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r bg-white p-4 shrink-0">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Buyer Panel</h2>
        <nav className="space-y-1">
          {menu.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/buyer/dashboard" && pathname?.startsWith(item.href + "/"))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 transition-colors",
                  isActive && "bg-slate-200 font-semibold text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
