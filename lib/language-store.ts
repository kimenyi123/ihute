import { create } from "zustand"

export type Language = "en" | "fr" | "rw"

interface LanguageStore {
  language: Language
  /** Updates UI language and persists to `localStorage` key `grandma:lang` (shared with Grandma + seller signup). */
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageStore>()((set) => ({
  /** Default matches Grandma buyer/seller shell (Kinyarwanda first). */
  language: "rw",
  setLanguage: (language) => {
    set({ language })
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("grandma:lang", language)
      } catch {
        /* ignore */
      }
    }
  },
}))
