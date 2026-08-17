"use client"

import Link from "next/link"
import { Bike, MessageSquare, Package, ShoppingCart, Store, UserCog, Users } from "lucide-react"

const tiles: { href: string; title: string; subtitle: string; icon: typeof Store }[] = [
  { href: "/admin_grandma/sellers", title: "Seller", subtitle: "List & profile completion", icon: Store },
  { href: "/admin_grandma/buyers", title: "Buyer", subtitle: "Buyer accounts (soon)", icon: Users },
  { href: "/admin_grandma/riders", title: "Riders", subtitle: "Delivery riders (soon)", icon: Bike },
  { href: "/admin_grandma/agents", title: "Agents", subtitle: "Field agents (soon)", icon: UserCog },
  { href: "/admin_grandma/orders", title: "Orders", subtitle: "Order monitor (soon)", icon: ShoppingCart },
  { href: "/admin_grandma/items", title: "Items", subtitle: "Pending validation · Umuriro drafts", icon: Package },
  { href: "/admin/client-suggestions", title: "Client Suggestions", subtitle: "Support form feedback", icon: MessageSquare },
]

export default function AdminGrandmaDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Grandma operations</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Internal dashboard — not the blue consumer app. Wire MySQL with ONBOARDING_MYSQL_* for live rows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 group-hover:bg-zinc-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-white">{t.title}</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">{t.subtitle}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
