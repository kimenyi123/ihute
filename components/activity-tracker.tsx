"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  registerActivityFlushOnHide,
  trackPageView,
  trackSessionStart,
} from "@/lib/activity-tracker"

/** Root layout client hook: session start + page views + flush on tab hide. */
export function ActivityTracker() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    trackSessionStart()
    return registerActivityFlushOnHide()
  }, [])

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return
    lastPath.current = pathname
    trackPageView(pathname)
  }, [pathname])

  return null
}
