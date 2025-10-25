import { create } from "zustand"

export type Language = "en" | "fr" | "rw"

interface LanguageStore {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageStore>()((set) => ({
  language: "en",
  setLanguage: (language) => set({ language }),
}))
