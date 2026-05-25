"use client"

import { useEffect } from "react"

import { useLanguageStore, type Language } from "@/lib/language-store"

function readStoredLang(): Language | null {
  try {
    const g = localStorage.getItem("grandma:lang")
    if (g === "en" || g === "rw" || g === "fr") return g
  } catch {
    /* ignore */
  }
  return null
}

/** Keeps `document.documentElement.lang`, zustand, and `localStorage.grandma:lang` aligned across the app. */
export function LanguageSyncProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  useEffect(() => {
    const stored = readStoredLang()
    if (stored) setLanguage(stored)

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "grandma:lang") return
      const v = e.newValue
      if (v === "en" || v === "rw" || v === "fr") setLanguage(v)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [setLanguage])

  useEffect(() => {
    document.documentElement.lang = language === "rw" ? "rw" : language
  }, [language])

  return <>{children}</>
}
