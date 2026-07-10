"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  registerActivityFlushOnHide,
  trackPageView,
  trackSessionStart,
} from "@/lib/activity-tracker"

/** Root layout client hook: session start + page views + flush on tab hide. */
export function ActivityTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    trackSessionStart()
    return registerActivityFlushOnHide()
  }, [])

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams?.toString() || ""
    const fullPath = qs ? `${pathname}?${qs}` : pathname
    if (fullPath === lastPath.current) return
    lastPath.current = fullPath
    trackPageView(fullPath)
  }, [pathname, searchParams])

  return null
}
