"use client"

import { useEffect } from "react"

import { useLanguageStore } from "@/lib/language-store"

/**
 * Keeps `document.documentElement.lang`, zustand store, and `localStorage`
 * (`grandma:lang`) aligned across the app. Also handles cross-tab sync.
 *
 * Mount once near the root (e.g. in layout.tsx / providers).
 */
export function LanguageSyncProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((s) => s.language)
  const hasHydrated = useLanguageStore((s) => s.hasHydrated)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const hydrate = useLanguageStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "grandma:lang") return
      const v = e.newValue
      if (v === "en" || v === "rw" || v === "fr") setLanguage(v as typeof language)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [hydrate, setLanguage])

  useEffect(() => {
    if (!hasHydrated) return
    document.documentElement.lang = language
    document.documentElement.dir = "ltr"
  }, [language, hasHydrated])

  return <>{children}</>
}
