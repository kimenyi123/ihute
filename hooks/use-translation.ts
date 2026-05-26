import { useCallback } from "react"
import { useLanguageStore, type Language } from "@/lib/language-store"
import { translations, type TranslationKey } from "@/lib/translations"
import { getLocaleValue } from "@/lib/i18n-utils"

/**
 * Primary translation hook.
 *
 * Supports two call styles:
 *   t("addToCart")           — flat key (legacy, looks up translations[lang][key])
 *   t("cart.checkout")       — dot-path key (looks up locales/xx.json tree)
 *
 * Optional interpolation:
 *   t("cart.itemCount", { count: 3 })  →  "3 items" (replaces {{count}})
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language)

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value: string | undefined

      if (key.includes(".")) {
        value = getLocaleValue(language, key) ?? getLocaleValue("en", key)
      }

      if (!value) {
        const flat = key as TranslationKey
        value =
          translations[language]?.[flat] ??
          translations.en?.[flat] ??
          key
      }

      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v))
        }
      }

      return value
    },
    [language],
  )

  return { t, language } as const
}

/**
 * Tri-pattern helper: pick the right language from a `{en, rw, fr}` object.
 * Re-exported here so components can import from one place.
 */
export function pickLang(tri: { en: string; rw: string; fr: string }, lang: Language): string {
  return tri[lang] ?? tri.en
}
