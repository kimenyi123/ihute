"use client"

import { trackEvent } from "@/lib/activity-tracker"

let installed = false

/** Patch `window.fetch` once to log 5xx responses to activity_events. */
export function installMonitoredFetch() {
  if (installed || typeof window === "undefined") return
  installed = true
  const original = window.fetch.bind(window)
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const res = await original(...args)
    if (res.status >= 500) {
      let endpoint = ""
      const input = args[0]
      if (typeof input === "string") {
        endpoint = input
      } else if (input instanceof Request) {
        endpoint = input.url
      } else if (input instanceof URL) {
        endpoint = input.toString()
      }
      trackEvent("error", {
        status: "failed",
        metadata: { statusCode: res.status, endpoint },
        message: `API ${res.status}`,
      })
    }
    return res
  }
}
