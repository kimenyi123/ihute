"use client"

import { Store, Users, CreditCard, Truck } from "lucide-react"

export function StatsSection() {
  const stats = [
    {
      icon: Store,
      value: "500+",
      label: "Active Suppliers",
      color: "text-blue-600",
    },
    {
      icon: Users,
      value: "10,000+",
      label: "Happy Customers",
      color: "text-green-600",
    },
    {
      icon: CreditCard,
      value: "5+",
      label: "Payment Methods",
      color: "text-purple-600",
    },
    {
      icon: Truck,
      value: "Fast",
      label: "Delivery Service",
      color: "text-orange-600",
    },
  ]

  return (
    <section className="py-4 bg-slate-50/50 border-y border-slate-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around gap-4 flex-wrap">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-slate-900">{stat.value}</span>
                  <span className="text-xs text-slate-600">{stat.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
