"use client"

import { useEffect } from "react"
import { recordGrandmaApiFetch, shouldTrackGrandmaFetch } from "@/lib/grandma-fetch-stats"

/**
 * Patches `window.fetch` once to count `/api/*` outcomes for this session (Grandma routes only).
 */
export function GrandmaFetchTracker() {
  useEffect(() => {
    const orig = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const track = shouldTrackGrandmaFetch(input)
      let urlForLog = ""
      try {
        urlForLog =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url
    } catch {
        urlForLog = ""
      }
      try {
        const res = await orig(input, init)
        if (track) {
          recordGrandmaApiFetch(urlForLog || res.url, res.ok, res.status)
        }
        return res
      } catch (e: unknown) {
        if (track) {
          recordGrandmaApiFetch(urlForLog || "(request failed)", false, 0)
        }
        throw e
      }
    }
    return () => {
      window.fetch = orig
    }
  }, [])

  return null
}
