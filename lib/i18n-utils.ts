import type { Language } from "@/lib/language-store"

import en from "@/locales/en.json"
import rw from "@/locales/rw.json"
import fr from "@/locales/fr.json"

export type LocaleDict = Record<string, unknown>

const locales: Record<Language, LocaleDict> = { en, rw, fr }

/**
 * Resolve a dot-path key like `"cart.checkout"` against the structured locale JSON.
 * Returns `undefined` when the path doesn't exist so the caller can fall back.
 */
export function getLocaleValue(lang: Language, path: string): string | undefined {
  const parts = path.split(".")
  let node: unknown = locales[lang]

  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined
    node = (node as Record<string, unknown>)[part]
  }

  return typeof node === "string" ? node : undefined
}

/**
 * Get the entire namespace object for a language (e.g. `getNamespace("rw", "cart")`).
 * Useful for components that need many keys from the same group.
 */
export function getNamespace(lang: Language, ns: string): Record<string, string> {
  const section = locales[lang]?.[ns]
  if (section && typeof section === "object") return section as Record<string, string>
  const fallback = locales.en?.[ns]
  if (fallback && typeof fallback === "object") return fallback as Record<string, string>
  return {}
}
