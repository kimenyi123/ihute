"use client"

import { MapPin, Route, Radio, Map, Settings, History, Activity } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function GPSNavigation() {
    const pathname = usePathname()

    const navItems = [
        {
            title: "Live Location",
            href: "/supplier/gps/live",
            icon: Radio,
            description: "Current position & tracking"
        },
        {
            title: "Route History",
            href: "/supplier/gps/history",
            icon: History,
            description: "Daily/weekly movement patterns"
        },
        {
            title: "Activity Zones",
            href: "/supplier/gps/zones",
            icon: Activity,
            description: "Where you spend most time"
        },
        {
            title: "Coverage Area",
            href: "/supplier/gps/coverage",
            icon: Map,
            description: "Service area visualization"
        },
        {
            title: "GPS Settings",
            href: "/supplier/gps/settings",
            icon: Settings,
            description: "Privacy & controls"
        }
    ]

    return (
        <nav className="space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-start gap-3 px-3 py-2 rounded-lg transition-colors",
                            isActive
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-slate-700 hover:bg-slate-50"
                        )}
                    >
                        <Icon className={cn(
                            "h-5 w-5 mt-0.5 flex-shrink-0",
                            isActive ? "text-blue-600" : "text-slate-500"
                        )} />
                        <div className="flex-1 min-w-0">
                            <div className={cn(
                                "text-sm",
                                isActive ? "font-medium" : "font-normal"
                            )}>
                                {item.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {item.description}
                            </div>
                        </div>
                    </Link>
                )
            })}
        </nav>
    )
}
