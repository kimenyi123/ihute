"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { AdminGuard } from "@/components/auth/admin-guard"

export default function AdminGrandmaLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/admin_grandma" className="text-lg font-semibold tracking-tight text-white hover:text-zinc-200">
              Grandma · Ops
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <Link href="/admin_grandma" className="hover:text-zinc-200">
                Dashboard
              </Link>
              <Link href="/admin_grandma/orders" className="hover:text-zinc-200">
                Orders
              </Link>
              <Link href="/admin_grandma/items" className="hover:text-zinc-200">
                Drafts
              </Link>
              <Link href="/admin/dashboard" className="hover:text-zinc-200">
                Main admin
              </Link>
              <Link href="/" className="hover:text-zinc-200">
                Site
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </AdminGuard>
  )
}
