import { create } from "zustand"

export type Language = "en" | "fr" | "rw"

export const DEFAULT_LANGUAGE: Language = "rw"
export const SUPPORTED_LANGUAGES: readonly Language[] = ["rw", "en", "fr"] as const

const LS_KEY = "grandma:lang"

function isValidLang(v: unknown): v is Language {
  return v === "en" || v === "fr" || v === "rw"
}

function readPersistedLang(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (isValidLang(stored)) return stored
  } catch { /* SSR / restricted storage */ }
  return DEFAULT_LANGUAGE
}

interface LanguageStore {
  language: Language
  hasHydrated: boolean
  setLanguage: (language: Language) => void
  /** Call once on mount (LanguageSyncProvider) to load persisted preference. */
  hydrate: () => void
}

export const useLanguageStore = create<LanguageStore>()((set, get) => ({
  language: DEFAULT_LANGUAGE,
  hasHydrated: false,

  setLanguage: (language) => {
    if (!isValidLang(language)) return
    set({ language })
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LS_KEY, language)
      } catch { /* ignore */ }
    }
  },

  hydrate: () => {
    if (get().hasHydrated) return
    const stored = readPersistedLang()
    set({ language: stored, hasHydrated: true })
  },
}))

/**
 * SSR-safe language hook: returns DEFAULT_LANGUAGE until client hydration
 * is complete, preventing hydration mismatches. Use this instead of
 * `useLanguageStore(s => s.language)` in components that render translated
 * text visible during SSR.
 */
export function useHydratedLanguage(): Language {
  const language = useLanguageStore((s) => s.language)
  const hasHydrated = useLanguageStore((s) => s.hasHydrated)
  return hasHydrated ? language : DEFAULT_LANGUAGE
}
