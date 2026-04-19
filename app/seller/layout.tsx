"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoutButton } from "@/components/logout-button"

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const nav = [
    { href: "/seller", label: "Dashboard" },
    { href: "/seller/orders", label: "Orders" },
  ]

  function navActive(href: string) {
    if (href === "/seller") return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-r p-4 space-y-4">
        <div className="text-lg font-semibold">Seller Panel</div>
        <nav className="space-y-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded px-3 py-2 text-sm ${navActive(n.href) ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="pt-4">
          <LogoutButton className="w-full" />
        </div>
      </aside>
      <main className="p-4">{children}</main>
    </div>
  )
}


