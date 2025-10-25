import { useLanguageStore } from "@/lib/language-store"
import { translations, type TranslationKey } from "@/lib/translations"

export function useTranslation() {
  const { language } = useLanguageStore()

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key
  }

  return { t, language }
}
