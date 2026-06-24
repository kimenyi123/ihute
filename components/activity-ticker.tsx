"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, Star, Users, Package } from "lucide-react"

const EVENTS = [
  { icon: "cart",  text: "Someone in Kigali just ordered Paracetamol",         shop: "Rite Pharmacy",        time: "just now" },
  { icon: "table", text: "Table 4 sent their order",                            shop: "Pangolin's Burrows",   time: "1 min ago" },
  { icon: "star",  text: "Someone rated",                                       shop: "Simba Supermarket ⭐⭐⭐⭐⭐", time: "2 min ago" },
  { icon: "cart",  text: "Someone in Gasabo just ordered Mutzig x6",            shop: "Sawa Caters",          time: "3 min ago" },
  { icon: "order", text: "New order placed for fresh vegetables",                shop: "250 Stores",           time: "4 min ago" },
  { icon: "table", text: "Table 2 just joined a group order",                   shop: "Pangolin's Burrows",   time: "5 min ago" },
  { icon: "star",  text: "Someone rated",                                       shop: "Rite Pharmacy ⭐⭐⭐⭐⭐",  time: "6 min ago" },
  { icon: "cart",  text: "Someone in Nyarugenge ordered Amoxicillin",           shop: "Rite Pharmacy",        time: "7 min ago" },
  { icon: "order", text: "Bulk order confirmed",                                shop: "Spar Rwanda",          time: "8 min ago" },
  { icon: "cart",  text: "Someone just added Ibuprofen to cart",               shop: "Rite Pharmacy",        time: "just now" },
]

const ICON_MAP = {
  cart:  <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-green-600" />,
  star:  <Star className="h-3.5 w-3.5 shrink-0 text-yellow-500" />,
  table: <Users className="h-3.5 w-3.5 shrink-0 text-blue-500" />,
  order: <Package className="h-3.5 w-3.5 shrink-0 text-purple-500" />,
}

export function ActivityTicker() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % EVENTS.length)
        setVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const event = EVENTS[index]

  return (
    <div className="w-full bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-100 py-1.5 px-4 overflow-hidden">
      <div className="container mx-auto flex items-center gap-2">
        {/* Live dot */}
        <span className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-green-700 uppercase tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
          </span>
          Live
        </span>

        <span className="text-slate-400 text-xs shrink-0">·</span>

        {/* Ticker message */}
        <div
          className="flex items-center gap-1.5 text-xs text-slate-700 transition-all duration-400 min-w-0"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-6px)" }}
        >
          {ICON_MAP[event.icon as keyof typeof ICON_MAP]}
          <span className="truncate">
            {event.text}{" "}
            <span className="font-semibold text-slate-800">@ {event.shop}</span>
          </span>
          <span className="shrink-0 text-slate-400 ml-1">{event.time}</span>
        </div>
      </div>
    </div>
  )
}
