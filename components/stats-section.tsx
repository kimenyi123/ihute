"use client"

import { Store, Users, CreditCard, Truck } from "lucide-react"
import { useEffect, useState } from "react"

type Stats = {
  activeSuppliers: number
  totalCustomers: number
  totalOrders: number
  paymentMethods: number
}

export function StatsSection() {
  const [stats, setStats] = useState<Stats>({
    activeSuppliers: 500,
    totalCustomers: 10000,
    totalOrders: 5000,
    paymentMethods: 5,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats")
      const data = await response.json()

      if (data.ok) {
        setStats({
          activeSuppliers: data.activeSuppliers,
          totalCustomers: data.totalCustomers,
          totalOrders: data.totalOrders,
          paymentMethods: data.paymentMethods,
        })
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K+`
    }
    return `${num}+`
  }

  const statsDisplay = [
    {
      icon: Store,
      value: loading ? "..." : formatNumber(stats.activeSuppliers),
      label: "Active Suppliers",
      color: "text-blue-600",
    },
    {
      icon: Users,
      value: loading ? "..." : formatNumber(stats.totalCustomers),
      label: "Happy Customers",
      color: "text-green-600",
    },
    // Commented out Payment Methods stat - uncomment when needed
    // {
    //   icon: CreditCard,
    //   value: loading ? "..." : `${stats.paymentMethods}+`,
    //   label: "Payment Methods",
    //   color: "text-purple-600",
    // },
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
          {statsDisplay.map((stat, index) => {
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
